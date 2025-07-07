# Sadaora AI Assistant Platform

## Overview
An intelligent personal assistant platform powered by Large Language Models (LLMs) that delivers personalized insights by analyzing diverse user data including resumes, background information, hobbies, and achievements. 

The system operates through a sophisticated workflow: A central Personal Assistant generates three types of prompts (Manual, Selected, and Auto) based on user input and context. These prompts are distributed to specialized domain agents (Career, Hobby, Travel, Money, etc.) that leverage their knowledge bases and external tool integrations to gather relevant insights. The Personal Assistant then synthesizes these insights to provide the most accurate and helpful recommendations to users through an intuitive frontend interface.

Designed for scalability, the platform can seamlessly expand to support new domains and agent types while maintaining consistent performance and user experience.

## System Architecture
### Core Components

#### Personal Agent (LLM Orchestration)
**Role & Core Responsibilities**: Serves as the central orchestrator of the user's interaction with the LLM-driven platform, managing the entire conversation flow and coordinating various microservices:
- **Session & Context Management**: Maintain user session state, conversation history, and dynamic user context (profile, background)
- **Prompt Orchestration**: Coordinate generation, evaluation, and selection of P1/P2/P3 prompts
- **Agent Interaction**: Route prompts to and receive responses (insights, tool calls) from specialized Agents
- **Tool Call Execution**: Parse Agent tool call instructions, trigger Tool Executor, and integrate results
- **Insight Synthesis**: Send combined Agent insights and tool results to Insight Synthesizer for final consolidation
- **Response Generation**: Format and return final insights to the Frontend UI
- **Implicit Feedback Collection**: Log user interaction patterns for system optimization

#### Prompt Generator Engine
**Core Responsibilities**: Focus on automatically generating P3 (Auto Prompts) by analyzing current user session context and Agent feedback:
- Receive Generation Instructions and Context from Personal Agent with relevant session context
- Generate multiple P3 Prompt suggestions based on input context and internal logic
- Continuously optimize generation strategies to improve effectiveness and adoption rate of P3 Prompts
- Output generated P3 Prompts to Prompt Evaluator/Filter for evaluation

#### Prompt Evaluator/Filter
**Core Responsibilities**: Act as unified quality control and security gate for all Prompts (P1, P2, P3):
- Receive P1/P2 Prompts from Prompt Manager and P3 Prompts from Prompt Generator Engine
- Perform safety filtering (content moderation) to block harmful or policy-violating Prompts
- Evaluate Prompt clarity, relevance, completeness, and potential value
- Assign value scores/rankings to help Personal Agent select optimal Prompts
- Optionally perform minor adjustments/rewrites to improve quality and format compliance
- Return evaluated and filtered Prompts to Personal Agent

#### Agents Manager
**Core Responsibilities**: Intelligent coordinator and router between Personal Agent and specific Agents:
- Dynamically select most appropriate Agent(s) based on Prompt content, user context, and Agent capabilities
- Maintain list of available Agents and their capability descriptions
- Monitor Agent operational status and distribute load across healthy instances
- Provide single API interface for Personal Agent to invoke different Agents
- Receive processing results from Agents and forward to Personal Agent
- Process feedback signals to optimize Agent routing strategies

#### Tool Executor
**Core Responsibilities**: Unified gateway for external tool invocations by Personal Agent:
- Parse tool invocation instructions, identifying tool name and parameters
- Maintain list of available tools and their API specifications
- Execute corresponding internal/external tools (database queries, API calls, web searches)
- Encapsulate raw results into format understandable by Personal Agent
- Handle errors during execution and log detailed information
- Ensure security and authorization for all tool invocations

#### Insight Synthesizer
**Core Responsibilities**: Integrate raw insights and results from various Agents and Tool Executor, transforming them into structured, refined, and easily understandable Final Insights:
- **Receive Raw Data**: Accept Agent Insights (LLM-generated text) and Tool Results (structured data from tool calls)
- **Information Integration & Disambiguation**: Merge information from different sources, resolving conflicts or redundancies
- **Refinement & Summarization**: Remove redundancy and non-critical details to generate concise core insights
- **Formatting & Personalization**: Format insights into user-friendly presentations (bullet points, tables, charts) with personalization
- **Multi-modal Support (Optional)**: Potential future integration for generating image, voice, or other multi-modal outputs
- **Output Final Insights**: Return user-consumable insights to the Personal Agent

#### User Feedback Service
**Core Responsibilities**: Collect, process, store, and distribute user feedback to drive continuous system optimization:
- **Collect Explicit Feedback**: Receive satisfaction ratings, text comments, and suggestions from frontend UI
- **Collect Implicit Feedback**: Capture user interaction behavior data (P3 prompt adoption rate, insight modifications)
- **Store Feedback Data**: Persist all collected feedback as foundation for analysis and model training
- **Pre-process Feedback Data**: Perform NLP on text feedback (sentiment analysis, keyword extraction) and aggregate structured data
- **Distribute Feedback Signals**: Asynchronously distribute processed feedback to relevant modules (Prompt Evaluator, Generator Engine, Agents Manager)
- **Provide Feedback Query Interface**: Offer interface for internal systems to query and analyze feedback data

For high-level architecture details, refer to the [architecture documentation](docs/architecture/high_level_architecture.md).

## Technology Stack

### Frontend
- React/Next.js
- TypeScript
- Tailwind CSS

### Backend
- Python/FastAPI
- LangChain/LlamaIndex
- PostgreSQL/MongoDB
- Redis
- Vector Databases (Pinecone/Weaviate)

### Infrastructure
- Google Cloud Platform (GCP)
- Docker
- Kubernetes
- Prometheus
- Grafana

## Deployment
Deployed on Google Cloud Platform (GCP) with the following services:
- Google Kubernetes Engine (GKE) for container orchestration
- Cloud Functions for serverless computing
- Cloud API Gateway for request routing
- Cloud SQL and Cloud Firestore for data persistence
- Cloud CDN for content delivery
- VPC for network isolation
- Cloud Monitoring and Logging for observability

## Getting Started
1. Clone the repository
2. Install dependencies: `pip install -r requirements.txt`
3. Configure environment variables in `config/development/`
4. Start development server: `uvicorn backend.main:app --reload`
5. Access frontend at `http://localhost:3000`

## Project Structure
```
Product/
├── .gitignore
├── README.md
├── backend/                # Backend services and API layer
│   ├── api/                # API route definitions
│   ├── db/                 # Database connections and migrations
│   ├── middlewares/        # Request processing middlewares
│   ├── models/             # Data models and schemas
│   ├── services/           # Business logic implementation
│   └── utils/              # Utility functions and helpers
├── config/                 # Configuration files
│   ├── development/        # Development environment settings
│   ├── production/         # Production environment settings
│   └── test/               # Testing environment settings
├── deploy/                 # Deployment scripts and configurations
├── docs/                   # Project documentation
│   ├── api/                # API documentation
│   ├── architecture/       # Architecture diagrams and documentation
│   ├── deployment/         # Deployment guides
│   └── development/        # Development guidelines
├── frontend/               # Frontend application
│   ├── components/         # Reusable UI components
│   ├── pages/              # Application pages
│   ├── public/             # Static assets
│   ├── src/                # Source code
│   ├── styles/             # CSS/SCSS styles
│   └── utils/              # Frontend utilities
├── modules/                # Core system modules
│   ├── agents/             # Specialized AI agents
│   │   ├── body/           # Health and fitness agent
│   │   ├── career/         # Career guidance agent
│   │   ├── family_life/    # Family life agent
│   │   ├── hobby/          # Hobby and interests agent
│   │   ├── knowledge/      # Knowledge management agent
│   │   ├── mind/           # Mental wellbeing agent
│   │   ├── money/          # Financial management agent
│   │   ├── personal_dev/   # Personal development agent
│   │   ├── spiritual/      # Spiritual wellbeing agent
│   │   └── travel/         # Travel planning agent
│   ├── insight_synthesizer/ # Insight aggregation and synthesis
│   ├── personal_agent/     # Main personal assistant module
│   ├── prompts/            # Prompt templates and management
│   ├── tools/              # External tool integration
│   └── user_feedback/      # User feedback collection and processing
├── scripts/                # Utility scripts
└── tests/                  # Test suites
    ├── integration_tests/  # Integration tests
    ├── performance_tests/  # Performance tests
    └── smoke_tests/        # Smoke tests
```

## Contributing
We welcome contributions to improve our personal AI assistant platform. Please follow these guidelines to ensure a smooth collaboration process:

### Development Workflow
1. Fork the repository and create your branch from `develop`
2. Follow the [development setup guide](docs/development/development_setup.md) to configure your environment
3. Implement your changes following our [coding guidelines](docs/development/coding_guidelines.md)
4. Add tests for new features or bug fixes
5. Submit a pull request to the `develop` branch

### Branch Management
- `main`: Production-ready code
- `develop`: Integration branch for features
- Feature branches: `feature/descriptive-name`
- Bug fixes: `bugfix/issue-number-description`
- Hotfixes: `hotfix/critical-issue-description`
- Release branches: `release/vX.Y.Z`

### Code Standards
- Follow the style guidelines in [coding_guidelines.md](docs/development/coding_guidelines.md)
- Write meaningful comments and maintain up-to-date documentation
- Use proper JSDoc/docstring formats for all public APIs
- Ensure code passes all linting and formatting checks

### Testing Requirements
- Add unit tests for new functionality
- Maintain >80% code coverage
- Follow our [testing strategy](docs/development/testing_strategy.md)
- Test in multiple environments when applicable

### Documentation
- Update documentation when adding new features
- Include usage examples for public APIs
- Maintain architecture diagrams
- Update the changelog with significant changes

For detailed information, please review our complete [contribution guidelines](docs/development/contribution_guidelines.md).

## License
[MIT](LICENSE)