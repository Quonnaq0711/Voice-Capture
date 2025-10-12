# Docker Port Mapping Explanation

## Understanding Docker Port Mapping

### The Format: `external:internal`

```yaml
ports:
  - "11435:11434"
     ↑       ↑
  External  Internal
  (Host)    (Container)
```

## Ollama Services Port Configuration

### Service 1: ollama-staging (Personal Assistant)

**docker-compose.yml:**
```yaml
ollama-staging:
  ports:
    - "11434:11434"  # External 11434 → Internal 11434
  networks:
    staging-network:
      aliases:
        - ollama-staging
```

**Access Methods:**

| From | URL | Port Used |
|------|-----|-----------|
| **Host/External** | `http://localhost:11434` | External: 11434 |
| **PA Container** | `http://ollama-staging:11434` | Internal: 11434 |

### Service 2: ollama2-staging (Career Agent)

**docker-compose.yml:**
```yaml
ollama2-staging:
  ports:
    - "11435:11434"  # External 11435 → Internal 11434
  networks:
    staging-network:
      aliases:
        - ollama2-staging
```

**Access Methods:**

| From | URL | Port Used |
|------|-----|-----------|
| **Host/External** | `http://localhost:11435` | External: 11435 |
| **Career Container** | `http://ollama2-staging:11434` | Internal: 11434 ⚠️ |

## ⚠️ Common Mistake

**WRONG:** Using external port in container-to-container communication
```python
# ❌ INCORRECT
DEFAULT_CAREER_OLLAMA_URL = "http://ollama2-staging:11435"  # Wrong!
```

**CORRECT:** Always use internal port for container communication
```python
# ✅ CORRECT
DEFAULT_CAREER_OLLAMA_URL = "http://ollama2-staging:11434"  # Correct!
```

## Why Different Ports Externally but Same Internally?

1. **Ollama container always listens on port 11434** inside the container
2. **We cannot change** the internal port Ollama listens on
3. **We can map** different external ports to avoid conflicts
4. **Containers communicate** using Docker network DNS and internal ports

## Visual Representation

```
┌──────────────────────────────────────────────────┐
│              Host Machine (GCP)                   │
│                                                   │
│  External Access:                                 │
│  ├─ localhost:11434 ─┐                           │
│  └─ localhost:11435 ─┼───────────────┐           │
│                      │               │           │
│  ┌───────────────────▼──────────────▼──────────┐ │
│  │     Docker Network: idii-staging           │ │
│  │                                            │ │
│  │  ollama-staging       ollama2-staging     │ │
│  │  ┌─────────────┐     ┌─────────────┐     │ │
│  │  │   Listen:   │     │   Listen:   │     │ │
│  │  │   11434     │     │   11434     │     │ │
│  │  └──────▲──────┘     └──────▲──────┘     │ │
│  │         │                   │             │ │
│  │         │                   │             │ │
│  │  ┌──────┴──────┐     ┌──────┴──────┐     │ │
│  │  │     PA      │     │   Career    │     │ │
│  │  │  Container  │     │  Container  │     │ │
│  │  └─────────────┘     └─────────────┘     │ │
│  │         │                   │             │ │
│  │  Uses:  │            Uses:  │             │ │
│  │  ollama-staging:    ollama2-staging:     │ │
│  │      11434              11434             │ │
│  │         ↑                   ↑             │ │
│  │    Internal Port       Internal Port     │ │
│  └────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

## Testing Connectivity

### From Host (External):

```bash
# Test first Ollama instance
curl http://localhost:11434/api/tags

# Test second Ollama instance
curl http://localhost:11435/api/tags
```

### From PA Container (Internal):

```bash
docker exec idii-PA-staging curl http://ollama-staging:11434/api/tags
```

### From Career Agent Container (Internal):

```bash
docker exec idii-career-agent-staging curl http://ollama2-staging:11434/api/tags
```

## Configuration Summary

### ✅ Correct Configuration

| File | Configuration | Port |
|------|---------------|------|
| `docker-compose.yml` (ollama2) | `"11435:11434"` | Mapping |
| `.env.staging` | `http://ollama2-staging:11434` | Internal |
| `chat_service.py` | `http://ollama2-staging:11434` | Internal |
| `start_chat_api.py` | `http://ollama2-staging:11434` | Internal |

### Key Takeaway

**Always use internal port (11434) for container-to-container communication, regardless of the external port mapping!**
