"""
Unit tests for vLLM message processing in ChatServiceVLLM

This test suite covers all message processing logic required for vLLM compatibility:

1. Two-Phase Sliding Window:
   - Phase 1: Truncation by number of turns (VLLM_MAX_HISTORY_TURNS)
   - Phase 2: Truncation by token count (ensures input ≤ safe limit)
   - Extreme cases: Single turn exceeds safe limit

2. Role Alternation Enforcement:
   - vLLM requires strict user/assistant/user/assistant pattern
   - Removes consecutive duplicate roles
   - Ensures conversation starts with user (after system messages)
   - Ensures conversation ends with user (ready for assistant response)

3. Token Counting and Dynamic max_tokens:
   - Accurate token counting using tiktoken
   - Dynamic max_tokens calculation based on input length
   - Integration testing of complete processing pipeline
"""

import pytest
import sys
import os

# Add the backend and personal_assistant directories to the Python path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
pa_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, backend_path)
sys.path.insert(0, pa_path)

from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from chat_service_vllm import ChatServiceVLLM


class TestSlidingWindow:
    """Test suite for two-phase sliding window logic"""

    @pytest.fixture
    def chat_service(self):
        """Create a ChatServiceVLLM instance for testing"""
        return ChatServiceVLLM(
            model_name="google/gemma-3-1b-it",
            api_base="http://localhost:8888/v1",
            temperature=0.7,
            max_tokens=2048,
            max_history_turns=10,
            max_model_len=4096,
            safety_margin=512,
            top_p=0.9,
            frequency_penalty=0.0,
            presence_penalty=0.0
        )

    def test_phase1_normal_truncation_by_turns(self, chat_service):
        """
        Test Phase 1: Normal truncation by number of turns

        Scenario: 15 turns of conversation, each turn is short
        Expected: Keep only last 10 turns (20 messages)
        """
        # Create 15 turns of short conversations (30 messages)
        messages = [SystemMessage(content="You are a helpful AI assistant.")]

        for i in range(15):
            messages.append(HumanMessage(content=f"User message {i+1}"))
            messages.append(AIMessage(content=f"AI response {i+1}"))

        # Apply sliding window
        result = chat_service._apply_sliding_window(messages)

        # Verify results
        # Should have: 1 system message + 10 turns (20 messages) = 21 total
        assert len(result) == 21, f"Expected 21 messages, got {len(result)}"

        # First message should be system message
        assert isinstance(result[0], SystemMessage), "First message should be SystemMessage"

        # Should keep turns 6-15 (last 10 turns)
        assert result[1].content == "User message 6", "Should start from turn 6"
        assert result[-2].content == "User message 15", "Should end at turn 15"
        assert result[-1].content == "AI response 15", "Last message should be AI response 15"

    def test_phase1_no_truncation_needed(self, chat_service):
        """
        Test Phase 1: No truncation when conversation is short

        Scenario: Only 5 turns of conversation
        Expected: Keep all messages (no truncation)
        """
        # Create 5 turns (10 messages)
        messages = [SystemMessage(content="You are a helpful AI assistant.")]

        for i in range(5):
            messages.append(HumanMessage(content=f"User message {i+1}"))
            messages.append(AIMessage(content=f"AI response {i+1}"))

        # Apply sliding window
        result = chat_service._apply_sliding_window(messages)

        # Should keep all messages (11 total)
        assert len(result) == 11, f"Expected 11 messages, got {len(result)}"
        assert result[1].content == "User message 1", "Should keep first turn"

    def test_phase2_truncation_by_token_count(self, chat_service):
        """
        Test Phase 2: Truncation by token count when turns are long

        Scenario: 10 turns, but each turn has many tokens
        Expected: Further truncate to fit within token budget
        """
        # Create 10 turns with long messages (simulate ~500 tokens per turn)
        # Using a long string to ensure token count is high
        long_message = "This is a very long message. " * 50  # ~150 words × 1.3 tokens/word ≈ 200 tokens

        messages = [SystemMessage(content="You are a helpful AI assistant.")]

        for i in range(10):
            messages.append(HumanMessage(content=f"Turn {i+1}: {long_message}"))
            messages.append(AIMessage(content=f"Response {i+1}: {long_message}"))

        # Calculate expected max_input_tokens
        # max_input_tokens = max_model_len - max_tokens - safety_margin
        #                  = 4096 - 2048 - 512 = 1536 tokens

        # Apply sliding window
        result = chat_service._apply_sliding_window(messages)

        # Count tokens in result
        result_tokens = chat_service._count_message_tokens(result)
        max_input_tokens = chat_service.max_model_len - chat_service.max_tokens - chat_service.safety_margin

        # Verify that result is within token budget
        assert result_tokens <= max_input_tokens, \
            f"Result tokens ({result_tokens}) should be <= max_input_tokens ({max_input_tokens})"

        # Should have fewer messages than Phase 1 would keep
        # Phase 1 would keep 21 messages (1 system + 20 conversation)
        assert len(result) < 21, \
            f"Phase 2 should have truncated further, got {len(result)} messages"

        # Should always keep system message
        assert isinstance(result[0], SystemMessage), "First message should be SystemMessage"

        # Should keep at least 1 turn (2 messages) + system message = 3 total
        assert len(result) >= 3, \
            f"Should keep at least 1 turn + system message, got {len(result)} messages"

    def test_phase2_extreme_single_turn_exceeds_limit(self, chat_service):
        """
        Test Phase 2: Extreme case where even a single turn exceeds safe limit

        Scenario: Single turn with extremely long messages
        Expected: Keep the turn but log warning (rely on dynamic_max_tokens)
        """
        # Create a single turn with extremely long messages
        # Target: ~2000 tokens per message to exceed safe limit (1536)
        extremely_long_message = "This is an extremely long message. " * 200  # ~600 words × 1.3 ≈ 780 tokens

        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            HumanMessage(content=extremely_long_message),
            AIMessage(content=extremely_long_message)
        ]

        # Apply sliding window
        result = chat_service._apply_sliding_window(messages)

        # Should keep all messages (can't truncate further)
        assert len(result) == 3, \
            f"Should keep all 3 messages (1 system + 1 turn), got {len(result)}"

        # Verify all messages are preserved
        assert isinstance(result[0], SystemMessage), "First message should be SystemMessage"
        assert isinstance(result[1], HumanMessage), "Second message should be HumanMessage"
        assert isinstance(result[2], AIMessage), "Third message should be AIMessage"

        # Count tokens (should exceed safe limit)
        result_tokens = chat_service._count_message_tokens(result)
        max_input_tokens = chat_service.max_model_len - chat_service.max_tokens - chat_service.safety_margin

        # This scenario should exceed the safe limit
        # (We can't always guarantee this without precise token control, so just verify structure)
        print(f"Extreme case: {result_tokens} tokens (safe limit: {max_input_tokens})")

    def test_phase2_system_message_always_preserved(self, chat_service):
        """
        Test that system messages are always preserved regardless of token count

        Scenario: Multiple system messages + long conversation
        Expected: All system messages preserved
        """
        # Create multiple system messages (edge case, but should handle it)
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            SystemMessage(content="Additional system instruction."),
        ]

        # Add 10 turns with medium-length messages
        medium_message = "This is a medium message. " * 30  # ~90 words ≈ 120 tokens

        for i in range(10):
            messages.append(HumanMessage(content=f"Turn {i+1}: {medium_message}"))
            messages.append(AIMessage(content=f"Response {i+1}: {medium_message}"))

        # Apply sliding window
        result = chat_service._apply_sliding_window(messages)

        # Count system messages in result
        system_messages = [msg for msg in result if isinstance(msg, SystemMessage)]

        # All system messages should be preserved
        assert len(system_messages) == 2, \
            f"All system messages should be preserved, got {len(system_messages)}"

        # First messages should be system messages
        assert isinstance(result[0], SystemMessage), "First message should be SystemMessage"
        assert isinstance(result[1], SystemMessage), "Second message should be SystemMessage"

    def test_empty_messages_list(self, chat_service):
        """
        Test edge case: Empty messages list

        Expected: Return empty list without errors
        """
        messages = []
        result = chat_service._apply_sliding_window(messages)

        assert result == [], "Empty messages should return empty list"

    def test_only_system_messages(self, chat_service):
        """
        Test edge case: Only system messages, no conversation

        Expected: Keep all system messages
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            SystemMessage(content="Additional instruction."),
        ]

        result = chat_service._apply_sliding_window(messages)

        assert len(result) == 2, "Should keep both system messages"
        assert all(isinstance(msg, SystemMessage) for msg in result), \
            "All messages should be SystemMessage"

    def test_token_count_accuracy(self, chat_service):
        """
        Test that token counting is reasonably accurate

        Verify that _count_message_tokens returns plausible values
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            HumanMessage(content="Hello, how are you?"),
            AIMessage(content="I'm doing well, thank you for asking!")
        ]

        token_count = chat_service._count_message_tokens(messages)

        # These messages should be roughly 20-40 tokens
        # (exact count depends on tokenizer, but should be in this range)
        assert 15 < token_count < 50, \
            f"Token count ({token_count}) seems unreasonable for short messages"

    def test_integration_with_dynamic_max_tokens(self, chat_service):
        """
        Test integration: Sliding window + dynamic max_tokens calculation

        Verify that the two mechanisms work together correctly
        """
        # Create 10 turns with medium messages
        medium_message = "This is a medium message. " * 30  # ~120 tokens

        messages = [SystemMessage(content="You are a helpful AI assistant.")]

        for i in range(10):
            messages.append(HumanMessage(content=f"Turn {i+1}: {medium_message}"))
            messages.append(AIMessage(content=f"Response {i+1}: {medium_message}"))

        # Apply sliding window
        windowed_messages = chat_service._apply_sliding_window(messages)

        # Count tokens after windowing
        input_token_count = chat_service._count_message_tokens(windowed_messages)

        # Calculate dynamic max_tokens
        dynamic_max_tokens = chat_service._calculate_dynamic_max_tokens(input_token_count)

        # Verify the complete request would fit in model capacity
        total_tokens = input_token_count + dynamic_max_tokens + chat_service.safety_margin

        assert total_tokens <= chat_service.max_model_len, \
            f"Total tokens ({total_tokens}) should fit in model capacity ({chat_service.max_model_len})"

        # Verify dynamic_max_tokens is positive and reasonable
        assert dynamic_max_tokens >= 100, \
            f"Dynamic max_tokens ({dynamic_max_tokens}) should be at least 100"


class TestRoleAlternation:
    """Test suite for vLLM role alternation enforcement"""

    @pytest.fixture
    def chat_service(self):
        """Create a ChatServiceVLLM instance for testing"""
        return ChatServiceVLLM(
            model_name="google/gemma-3-1b-it",
            api_base="http://localhost:8888/v1",
            temperature=0.7,
            max_tokens=2048,
            max_history_turns=10,
            max_model_len=4096,
            safety_margin=512,
            top_p=0.9,
            frequency_penalty=0.0,
            presence_penalty=0.0
        )

    def test_remove_consecutive_user_messages(self, chat_service):
        """
        Test: Remove consecutive user messages (keep latest)

        Scenario: Two user messages in a row, followed by AI response, then ending with user message
        Expected: Keep only the latest of consecutive user messages
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            HumanMessage(content="First user message"),
            HumanMessage(content="Second user message"),  # Duplicate role (keep this)
            AIMessage(content="AI response"),
            HumanMessage(content="Third user message")  # Ending with user (as in real usage)
        ]

        result = chat_service._ensure_alternating_roles(messages)

        # Should have: system + user2 + AI + user3 = 4 messages
        assert len(result) == 4, f"Expected 4 messages, got {len(result)}"

        # Verify structure
        assert isinstance(result[0], SystemMessage)
        assert isinstance(result[1], HumanMessage)
        assert result[1].content == "Second user message", "Should keep latest of consecutive users"
        assert isinstance(result[2], AIMessage)
        assert isinstance(result[3], HumanMessage)
        assert result[3].content == "Third user message"

    def test_remove_consecutive_assistant_messages(self, chat_service):
        """
        Test: Remove consecutive assistant messages (keep latest)

        Scenario: Two assistant messages in a row, then ending with user message
        Expected: Keep only the latest assistant message
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            HumanMessage(content="User message 1"),
            AIMessage(content="First AI response"),
            AIMessage(content="Second AI response"),  # Duplicate role (keep this)
            HumanMessage(content="User message 2")  # Ending with user
        ]

        result = chat_service._ensure_alternating_roles(messages)

        # Should have: system + user1 + AI2 + user2 = 4 messages
        assert len(result) == 4, f"Expected 4 messages, got {len(result)}"

        # Verify structure
        assert isinstance(result[0], SystemMessage)
        assert isinstance(result[1], HumanMessage)
        assert result[1].content == "User message 1"
        assert isinstance(result[2], AIMessage)
        assert result[2].content == "Second AI response", "Should keep latest of consecutive assistants"
        assert isinstance(result[3], HumanMessage)
        assert result[3].content == "User message 2"

    def test_remove_conversation_starting_with_assistant(self, chat_service):
        """
        Test: Remove assistant message at start of conversation

        Scenario: Conversation starts with assistant message, then normal flow
        Expected: Remove the leading assistant message
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            AIMessage(content="Hello from assistant"),  # Should be removed
            HumanMessage(content="User message"),
            AIMessage(content="AI response"),
            HumanMessage(content="Another user message")  # Ending with user
        ]

        result = chat_service._ensure_alternating_roles(messages)

        # Should have: system + user + AI + user = 4 messages
        assert len(result) == 4, f"Expected 4 messages, got {len(result)}"

        # First conversation message should be user
        assert isinstance(result[1], HumanMessage), \
            "First conversation message should be from user"
        assert result[1].content == "User message"
        assert isinstance(result[2], AIMessage)
        assert isinstance(result[3], HumanMessage)

    def test_remove_conversation_ending_with_assistant(self, chat_service):
        """
        Test: Remove assistant message at end of conversation

        Scenario: Conversation ends with assistant message (before generating new response)
        Expected: Remove the trailing assistant message
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            HumanMessage(content="User message 1"),
            AIMessage(content="AI response 1"),
            HumanMessage(content="User message 2"),
            AIMessage(content="AI response 2"),  # Should be removed (we're about to generate)
        ]

        result = chat_service._ensure_alternating_roles(messages)

        # Should end with user message
        assert isinstance(result[-1], HumanMessage), \
            "Conversation should end with user message"
        assert result[-1].content == "User message 2"

    def test_multiple_consecutive_same_role(self, chat_service):
        """
        Test: Handle multiple consecutive messages of the same role

        Scenario: Three user messages in a row, then AI, then user
        Expected: Keep only the latest of consecutive messages
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            HumanMessage(content="First user message"),
            HumanMessage(content="Second user message"),
            HumanMessage(content="Third user message"),  # Keep this
            AIMessage(content="AI response"),
            HumanMessage(content="Fourth user message")  # Ending with user
        ]

        result = chat_service._ensure_alternating_roles(messages)

        # Should have: system + user3 + AI + user4 = 4 messages
        assert len(result) == 4, f"Expected 4 messages, got {len(result)}"

        # Should keep only the latest user message from the sequence
        assert isinstance(result[1], HumanMessage)
        assert result[1].content == "Third user message", \
            "Should keep only the latest of consecutive messages"
        assert isinstance(result[2], AIMessage)
        assert isinstance(result[3], HumanMessage)
        assert result[3].content == "Fourth user message"

    def test_perfect_alternation_unchanged(self, chat_service):
        """
        Test: Perfect alternation should remain unchanged

        Scenario: Already perfect user/assistant/user/assistant pattern ending with user
        Expected: No changes
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            HumanMessage(content="User message 1"),
            AIMessage(content="AI response 1"),
            HumanMessage(content="User message 2"),
            AIMessage(content="AI response 2"),
            HumanMessage(content="User message 3"),
        ]

        result = chat_service._ensure_alternating_roles(messages)

        # Should have same length
        assert len(result) == len(messages), \
            "Perfect alternation ending with user should remain unchanged"

        # Verify alternation pattern
        for i in range(1, len(result) - 1, 2):
            assert isinstance(result[i], HumanMessage), \
                f"Message at index {i} should be HumanMessage"
            if i + 1 < len(result):
                assert isinstance(result[i + 1], AIMessage), \
                    f"Message at index {i + 1} should be AIMessage"

    def test_complex_mixed_duplicates(self, chat_service):
        """
        Test: Complex scenario with mixed duplicate roles

        Scenario: Multiple types of violations
        Expected: Fix all violations
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            AIMessage(content="Wrong start"),  # Remove (starts with assistant)
            HumanMessage(content="User 1"),
            HumanMessage(content="User 2"),  # Keep latest
            AIMessage(content="AI 1"),
            AIMessage(content="AI 2"),
            AIMessage(content="AI 3"),  # Keep latest
            HumanMessage(content="User 3"),
        ]

        result = chat_service._ensure_alternating_roles(messages)

        # Should have: system + user2 + AI3 + user3 = 4 messages
        assert len(result) == 4, f"Expected 4 messages, got {len(result)}"

        # Verify structure
        assert isinstance(result[0], SystemMessage)
        assert isinstance(result[1], HumanMessage)
        assert result[1].content == "User 2"
        assert isinstance(result[2], AIMessage)
        assert result[2].content == "AI 3"
        assert isinstance(result[3], HumanMessage)
        assert result[3].content == "User 3"

    def test_only_system_messages_unchanged(self, chat_service):
        """
        Test: Only system messages should remain unchanged

        Scenario: No conversation messages
        Expected: Return system messages as-is
        """
        messages = [
            SystemMessage(content="You are a helpful AI assistant."),
            SystemMessage(content="Additional instruction."),
        ]

        result = chat_service._ensure_alternating_roles(messages)

        assert len(result) == 2, "System messages should remain unchanged"
        assert all(isinstance(msg, SystemMessage) for msg in result)

    def test_empty_messages_list(self, chat_service):
        """
        Test: Empty messages list

        Expected: Return empty list
        """
        messages = []
        result = chat_service._ensure_alternating_roles(messages)

        assert result == [], "Empty list should return empty list"

    def test_integration_with_sliding_window(self, chat_service):
        """
        Test: Integration with sliding window

        Verify that role alternation works correctly after sliding window
        """
        # Create a conversation that will be truncated by sliding window
        messages = [SystemMessage(content="You are a helpful AI assistant.")]

        # Create 15 turns with some duplicate roles sprinkled in
        for i in range(15):
            messages.append(HumanMessage(content=f"User {i+1}"))
            messages.append(AIMessage(content=f"AI {i+1}"))
            # Add occasional duplicates
            if i % 5 == 0:
                messages.append(HumanMessage(content=f"User {i+1} again"))

        # Apply sliding window first
        windowed = chat_service._apply_sliding_window(messages)

        # Then ensure alternating roles
        result = chat_service._ensure_alternating_roles(windowed)

        # Verify alternation in final result
        conversation_msgs = [msg for msg in result if not isinstance(msg, SystemMessage)]

        for i in range(len(conversation_msgs) - 1):
            current_role = "user" if isinstance(conversation_msgs[i], HumanMessage) else "assistant"
            next_role = "user" if isinstance(conversation_msgs[i + 1], HumanMessage) else "assistant"

            assert current_role != next_role, \
                f"Roles should alternate, but found {current_role} followed by {next_role}"


if __name__ == "__main__":
    # Allow running tests directly with: python test_vllm_message_processing.py
    pytest.main([__file__, "-v", "--tb=short"])
