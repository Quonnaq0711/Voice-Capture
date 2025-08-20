Selects most relevant previous questions for career conversation context using multi-hop topic relationships and intent classification.

## Installation

```bash
pip install numpy scikit-learn sentence-transformers
```

## Usage

### Demo Run
```bash
python Prompt_Evaluator.py --demo
```

### With JSON File
```bash
python Prompt_Evaluator.py --input input.json --output result.json
```

## Input Format

```json
{
  "current_question": {
    "id": "q6",
    "question_text": "I have a data science interview next week, what should I prepare?",
    "timestamp": "2024-01-15T11:00:00",
    "user_id": "user1",
    "session_id": "session1",
    "question_number": 6
  },
  "previous_questions": [
    {
      "id": "q1",
      "question_text": "I want to transition from marketing to data science",
      "timestamp": "2024-01-15T10:30:00", 
      "user_id": "user1",
      "session_id": "session1",
      "question_number": 1
    }
  ],
  "max_context_questions": 3
}
```

## Output

Returns JSON with:
- `selected_context`: Top N most relevant previous questions
- `context_scores`: Relevance scores and breakdowns
- `all_ranked_questions`: All questions ranked by relevance