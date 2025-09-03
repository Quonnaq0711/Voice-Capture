#!/usr/bin/env python3

import numpy as np
from typing import List, Dict, Tuple, Optional, Set
from dataclasses import dataclass, asdict
from datetime import datetime, timedelta
import re
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import json
import argparse
import sys

try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("Warning: sentence-transformers not available, using keyword-based similarity only")

@dataclass
class ConversationQuestion:
    id: str
    question_text: str
    timestamp: datetime
    user_id: str
    session_id: str
    question_number: int
    agent_response: Optional[str] = None

@dataclass
class ConversationContext:
    session_id: str
    user_id: str
    previous_questions: List[ConversationQuestion]
    current_question: ConversationQuestion
    max_context_questions: int = 3

class EnhancedCareerConversationSelector:

    def __init__(self, max_features: int = 1000):
        self.vectorizer = TfidfVectorizer(
            max_features=max_features,
            stop_words='english',
            ngram_range=(1, 3)
        )
       
        if SENTENCE_TRANSFORMERS_AVAILABLE:
            try:
                self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
            except:
                self.embedding_model = None
                print("Warning: Failed to load sentence transformer model, using keyword-based similarity")
        else:
            self.embedding_model = None
        
        # Career-specific topic categories
        self.career_topics = {
            'skills': ['skills', 'learn', 'programming', 'python', 'coding', 'technical', 'certifications', 'languages', 'tools', 'technologies'],
            'resume': ['resume', 'cv', 'experience', 'projects', 'portfolio', 'background', 'achievements'],
            'interview': ['interview', 'preparation', 'questions', 'tips', 'practice', 'behavioral', 'technical interview'],
            'transition': ['change', 'switch', 'transition', 'career change', 'move to', 'from', 'pivot'],
            'salary': ['salary', 'compensation', 'pay', 'negotiate', 'benefits', 'package', 'money'],
            'job_search': ['job', 'apply', 'applications', 'opportunities', 'hiring', 'openings', 'search'],
            'industry': ['data science', 'software', 'tech', 'marketing', 'finance', 'engineering', 'field'],
            'projects': ['project', 'portfolio', 'build', 'create', 'develop', 'showcase'],
            'timeline': ['how long', 'timeline', 'time', 'duration', 'when', 'schedule'],
            'preparation': ['prepare', 'study', 'practice', 'ready', 'get ready']
        }

        # Multi-hop topic relationships with weights
        self.topic_relationships = {
            # Direct relationships (1-hop)
            ('skills', 'interview'): 0.8,
            ('skills', 'preparation'): 0.7,
            ('resume', 'interview'): 0.6,
            ('projects', 'interview'): 0.7,
            ('transition', 'skills'): 0.8,
            ('preparation', 'interview'): 0.9,
            
            # 2-hop relationships
            ('skills', 'job search', 'interview'): 0.6,
            ('transition', 'skills', 'interview'): 0.7,
            ('projects', 'resume', 'interview'): 0.5,
            ('skills', 'preparation', 'interview'): 0.8,
            ('transition', 'preparation', 'interview'): 0.6,
            
            # 3-hop career progression paths
            ('transition', 'skills', 'preparation', 'interview'): 0.7,
            ('industry', 'skills', 'interview'): 0.5,
            ('transition', 'projects', 'interview'): 0.6,
        }

        # Question intent patterns
        self.intent_patterns = {
            'preparation': [
                r'should I learn', r'what.*learn', r'how to prepare', r'what languages',
                r'what skills', r'how do I', r'best way to', r'get ready'
            ],
            'evaluation': [
                r'interview', r'review', r'feedback', r'assess', r'evaluate',
                r'check', r'look at', r'thoughts on'
            ],
            'planning': [
                r'how long', r'timeline', r'when should', r'what\'s next',
                r'schedule', r'time.*take', r'duration'
            ],
            'guidance': [
                r'how to', r'should I', r'what.*do', r'advice', r'recommend',
                r'suggest', r'guidance', r'help'
            ],
            'information': [
                r'what is', r'tell me about', r'explain', r'what are',
                r'describe', r'define'
            ]
        }

        # Intent cross-relevance (how much one intent boosts another)
        self.intent_cross_relevance = {
            'evaluation': {
                'preparation': 0.8,  # If evaluating (interview), preparation questions are highly relevant
                'guidance': 0.6,
                'information': 0.4
            },
            'preparation': {
                'evaluation': 0.7,   # If preparing, evaluation/review questions are relevant
                'guidance': 0.8,
                'information': 0.5
            },
            'planning': {
                'preparation': 0.6,
                'guidance': 0.7,
                'information': 0.4
            },
            'guidance': {
                'preparation': 0.7,
                'planning': 0.6,
                'information': 0.5
            }
        }

    def calculate_semantic_similarity(self, question1: str, question2: str) -> float:
        if self.embedding_model is not None:
            try:
                embeddings = self.embedding_model.encode([question1, question2])
                similarity = cosine_similarity([embeddings[0]], [embeddings[1]])[0][0]
                return float(similarity)
            except:
                pass
        
        # Fallback to word overlap
        words1 = set(question1.lower().split())
        words2 = set(question2.lower().split())
        
        if len(words1) == 0 or len(words2) == 0:
            return 0.0
        
        overlap = len(words1.intersection(words2))
        overlap1 = overlap / len(words1)
        overlap2 = overlap / len(words2)
        return 2 * (overlap1 * overlap2) / (overlap1 + overlap2) if (overlap1 + overlap2) > 0 else 0.0
    
    def detect_career_topic(self, question_text: str) -> List[str]:
        """Detect which career topics this question relates to"""
        question_lower = question_text.lower()
        detected_topics = []
        
        for topic, keywords in self.career_topics.items():
            for keyword in keywords:
                if keyword in question_lower:
                    detected_topics.append(topic)
                    break
        
        return detected_topics
    
    def detect_question_intent(self, question_text: str) -> List[str]:
        """Detect the intent(s) of a question"""
        question_lower = question_text.lower()
        detected_intents = []
        
        for intent, patterns in self.intent_patterns.items():
            for pattern in patterns:
                if re.search(pattern, question_lower):
                    detected_intents.append(intent)
                    break
        
        return detected_intents if detected_intents else ['information']  # default intent
    
    def calculate_multi_hop_similarity(self, topics1: List[str], topics2: List[str]) -> float:
        """Calculate similarity using multi-hop topic relationships"""
        if not topics1 or not topics2:
            return 0.0
        
        max_similarity = 0.0
        
        # Check all combinations of topics
        for t1 in topics1:
            for t2 in topics2:
                # Direct match
                if t1 == t2:
                    max_similarity = max(max_similarity, 1.0)
                    continue
                
                # Check all relationship patterns
                for relationship, weight in self.topic_relationships.items():
                    if len(relationship) == 2:
                        # 1-hop relationship
                        if (t1, t2) == relationship or (t2, t1) == relationship:
                            max_similarity = max(max_similarity, weight)
                    
                    elif len(relationship) >= 3:
                        # Multi-hop relationship
                        if (t1 in relationship and t2 in relationship):
                            # Both topics are in the relationship chain
                            max_similarity = max(max_similarity, weight)
        
        return max_similarity
    
    def calculate_intent_similarity(self, intents1: List[str], intents2: List[str]) -> float:
        """Calculate similarity based on question intents"""
        if not intents1 or not intents2:
            return 0.0
        
        max_similarity = 0.0
        
        for i1 in intents1:
            for i2 in intents2:
                # Direct intent match
                if i1 == i2:
                    max_similarity = max(max_similarity, 1.0)
                    continue
                
                # Cross-intent relevance
                if i1 in self.intent_cross_relevance and i2 in self.intent_cross_relevance[i1]:
                    cross_score = self.intent_cross_relevance[i1][i2]
                    max_similarity = max(max_similarity, cross_score)
                
                if i2 in self.intent_cross_relevance and i1 in self.intent_cross_relevance[i2]:
                    cross_score = self.intent_cross_relevance[i2][i1]
                    max_similarity = max(max_similarity, cross_score)
        
        return max_similarity
    
    def detect_conversation_flow_relevance(self, previous_q: ConversationQuestion, 
                                         current_q: ConversationQuestion,
                                         all_previous: List[ConversationQuestion]) -> float:
        """Detect if previous question is part of the same conversation flow"""
        
        # Direct follow-up indicators
        follow_up_patterns = [
            r'what about', r'how about', r'also', r'additionally', 
            r'more specifically', r'in particular', r'regarding that',
            r'speaking of', r'on that note'
        ]
        
        current_text = current_q.question_text.lower()
        for pattern in follow_up_patterns:
            if re.search(pattern, current_text):
                return 0.3  # Boost for follow-up questions
        
        return 0.0
    
    def calculate_question_relevance(self, previous_q: ConversationQuestion,
                                   current_q: ConversationQuestion,
                                   all_previous: List[ConversationQuestion]) -> float:
        """Calculate how relevant a previous question is to the current question"""
        
        # 1. Semantic similarity
        semantic_sim = self.calculate_semantic_similarity(
            previous_q.question_text, current_q.question_text
        )
        
        # 2. Topic analysis
        prev_topics = self.detect_career_topic(previous_q.question_text)
        curr_topics = self.detect_career_topic(current_q.question_text)
        
        # Multi-hop topic similarity
        topic_sim = self.calculate_multi_hop_similarity(prev_topics, curr_topics)
        
        # 3. Intent analysis
        prev_intents = self.detect_question_intent(previous_q.question_text)
        curr_intents = self.detect_question_intent(current_q.question_text)
        
        # Intent similarity
        intent_sim = self.calculate_intent_similarity(prev_intents, curr_intents)
        
        # 4. Conversation flow relevance
        flow_relevance = self.detect_conversation_flow_relevance(
            previous_q, current_q, all_previous
        )
        
        # Weighted combination - adjusted to give more weight to intent and multi-hop topics
        relevance_score = (
            semantic_sim * 0.3 +        # Reduced semantic weight
            topic_sim * 0.4 +           # Increased topic weight (multi-hop)
            intent_sim * 0.2 +          # New intent component
            flow_relevance * 0.1        # Reduced flow weight
        )
        
        return relevance_score
    
    def rank_previous_questions(self, context: ConversationContext) -> List[Tuple[ConversationQuestion, float, Dict]]:
        """Rank all previous questions by relevance to current question"""
        
        if not context.previous_questions:
            return []
        
        scored_questions = []
        
        for prev_q in context.previous_questions:
            relevance_score = self.calculate_question_relevance(
                prev_q, context.current_question, context.previous_questions
            )
            
            # Additional breakdown for debugging
            semantic = self.calculate_semantic_similarity(prev_q.question_text, context.current_question.question_text)
            prev_topics = self.detect_career_topic(prev_q.question_text)
            curr_topics = self.detect_career_topic(context.current_question.question_text)
            topic_score = self.calculate_multi_hop_similarity(prev_topics, curr_topics)
            
            prev_intents = self.detect_question_intent(prev_q.question_text)
            curr_intents = self.detect_question_intent(context.current_question.question_text)
            intent_score = self.calculate_intent_similarity(prev_intents, curr_intents)
            
            flow = self.detect_conversation_flow_relevance(prev_q, context.current_question, context.previous_questions)
            
            breakdown = {
                'semantic': semantic,
                'topic': topic_score,
                'intent': intent_score,
                'flow': flow,
                'prev_topics': prev_topics,
                'curr_topics': curr_topics,
                'prev_intents': prev_intents,
                'curr_intents': curr_intents
            }
            
            scored_questions.append((prev_q, relevance_score, breakdown))
        
        # Sort by relevance score (highest first)
        scored_questions.sort(key=lambda x: x[1], reverse=True)
        
        return scored_questions
    
    def select_context_questions(self, context: ConversationContext) -> Dict:
        """Main function: Select most relevant previous questions for context"""
        
        # Rank all previous questions
        ranked_questions = self.rank_previous_questions(context)
        
        # Select top N questions
        selected_questions = ranked_questions[:context.max_context_questions]
        
        # Prepare results
        result = {
            'current_question': context.current_question,
            'selected_context': [q for q, score, breakdown in selected_questions],
            'context_scores': [(q.id, q.question_text, score, breakdown) for q, score, breakdown in selected_questions],
            'total_previous_questions': len(context.previous_questions),
            'selected_count': len(selected_questions),
            'all_ranked_questions': [(q.id, q.question_text, score, breakdown) for q, score, breakdown in ranked_questions]
        }
        
        return result


# JSON Serialization Helper Functions
def datetime_to_iso(dt):
    """Convert datetime to ISO string"""
    if isinstance(dt, datetime):
        return dt.isoformat()
    return dt

def iso_to_datetime(iso_str):
    """Convert ISO string to datetime"""
    if isinstance(iso_str, str):
        return datetime.fromisoformat(iso_str.replace('Z', '+00:00'))
    return iso_str

def question_to_dict(question: ConversationQuestion) -> dict:
    """Convert ConversationQuestion to dictionary"""
    data = asdict(question)
    data['timestamp'] = datetime_to_iso(data['timestamp'])
    return data

def dict_to_question(data: dict) -> ConversationQuestion:
    """Convert dictionary to ConversationQuestion"""
    data['timestamp'] = iso_to_datetime(data['timestamp'])
    return ConversationQuestion(**data)

def result_to_json_serializable(result: Dict) -> Dict:
    """Convert result to JSON-serializable format"""
    json_result = {
        'current_question': question_to_dict(result['current_question']),
        'selected_context': [question_to_dict(q) for q in result['selected_context']],
        'context_scores': [
            {
                'id': score_data[0],
                'question_text': score_data[1],
                'relevance_score': float(score_data[2]),
                'breakdown': {
                    'semantic': float(score_data[3]['semantic']),
                    'topic': float(score_data[3]['topic']),
                    'intent': float(score_data[3]['intent']),
                    'flow': float(score_data[3]['flow']),
                    'prev_topics': score_data[3]['prev_topics'],
                    'curr_topics': score_data[3]['curr_topics'],
                    'prev_intents': score_data[3]['prev_intents'],
                    'curr_intents': score_data[3]['curr_intents']
                }
            }
            for score_data in result['context_scores']
        ],
        'total_previous_questions': result['total_previous_questions'],
        'selected_count': result['selected_count'],
        'all_ranked_questions': [
            {
                'id': score_data[0],
                'question_text': score_data[1],
                'relevance_score': float(score_data[2]),
                'breakdown': {
                    'semantic': float(score_data[3]['semantic']),
                    'topic': float(score_data[3]['topic']),
                    'intent': float(score_data[3]['intent']),
                    'flow': float(score_data[3]['flow']),
                    'prev_topics': score_data[3]['prev_topics'],
                    'curr_topics': score_data[3]['curr_topics'],
                    'prev_intents': score_data[3]['prev_intents'],
                    'curr_intents': score_data[3]['curr_intents']
                }
            }
            for score_data in result['all_ranked_questions']
        ]
    }
    return json_result


def process_input_json(input_data: dict) -> dict:
    """Process input JSON and return result JSON"""
    
    # Parse previous questions
    previous_questions = []
    for q_data in input_data.get('previous_questions', []):
        previous_questions.append(dict_to_question(q_data))
    
    # Parse current question
    current_question = dict_to_question(input_data['current_question'])
    
    # Create context
    context = ConversationContext(
        session_id=input_data.get('session_id', current_question.session_id),
        user_id=input_data.get('user_id', current_question.user_id),
        previous_questions=previous_questions,
        current_question=current_question,
        max_context_questions=input_data.get('max_context_questions', 3)
    )
    
    # Initialize selector and get results
    selector = EnhancedCareerConversationSelector()
    result = selector.select_context_questions(context)
    
    # Convert to JSON-serializable format
    return result_to_json_serializable(result)


def create_demo_input() -> dict:
    """Create demo input data"""
    return {
        "session_id": "session1",
        "user_id": "user1",
        "max_context_questions": 3,
        "previous_questions": [
            {
                "id": "q1",
                "question_text": "I want to transition from marketing to data science",
                "timestamp": (datetime.now() - timedelta(minutes=30)).isoformat(),
                "user_id": "user1",
                "session_id": "session1",
                "question_number": 1,
                "agent_response": None
            },
            {
                "id": "q2",
                "question_text": "What programming languages should I learn for data science?",
                "timestamp": (datetime.now() - timedelta(minutes=25)).isoformat(),
                "user_id": "user1",
                "session_id": "session1",
                "question_number": 2,
                "agent_response": None
            },
            {
                "id": "q3",
                "question_text": "How should I structure my resume for data science roles?",
                "timestamp": (datetime.now() - timedelta(minutes=20)).isoformat(),
                "user_id": "user1",
                "session_id": "session1",
                "question_number": 3,
                "agent_response": None
            },
            {
                "id": "q4",
                "question_text": "What kind of projects should I include in my portfolio?",
                "timestamp": (datetime.now() - timedelta(minutes=15)).isoformat(),
                "user_id": "user1",
                "session_id": "session1",
                "question_number": 4,
                "agent_response": None
            },
            {
                "id": "q5",
                "question_text": "How long does it typically take to land a data science job?",
                "timestamp": (datetime.now() - timedelta(minutes=10)).isoformat(),
                "user_id": "user1",
                "session_id": "session1",
                "question_number": 5,
                "agent_response": None
            }
        ],
        "current_question": {
            "id": "q6",
            "question_text": "I have a data science interview next week, what should I prepare?",
            "timestamp": datetime.now().isoformat(),
            "user_id": "user1",
            "session_id": "session1",
            "question_number": 6,
            "agent_response": None
        }
    }


def main():
    """Main function for command-line usage"""
    parser = argparse.ArgumentParser(description='Enhanced Career Conversation Selector')
    parser.add_argument('--input', '-i', type=str, help='Input JSON file path')
    parser.add_argument('--output', '-o', type=str, help='Output JSON file path')
    parser.add_argument('--demo', action='store_true', help='Run with demo data')
    
    args = parser.parse_args()
    
    try:
        if args.demo:
            # Use demo data
            input_data = create_demo_input()
        elif args.input:
            # Read from input file
            with open(args.input, 'r', encoding='utf-8') as f:
                input_data = json.load(f)
        else:
            # Read from stdin
            input_data = json.load(sys.stdin)
        
        # Process the input
        result = process_input_json(input_data)
        
        # Output the result
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
        else:
            print(json.dumps(result, indent=2, ensure_ascii=False))
            
    except Exception as e:
        error_result = {
            "error": str(e),
            "error_type": type(e).__name__
        }
        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(error_result, f, indent=2)
        else:
            print(json.dumps(error_result, indent=2))
        sys.exit(1)


if __name__ == "__main__":
    main()