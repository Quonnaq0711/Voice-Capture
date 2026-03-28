# AI Career Intelligence Engine --- Workflow Overview

## 🚀 What This System Does

This backend aggregates user data, enriches it with SOC and MSA, pulls
labor data from BLS and O\*NET, computes analytics, generates charts,
caches results, and produces AI insights.

## 🧭 Workflow

User Request → Auth → Aggregate → Enrich → Fetch Data → Analyze → LLM
Insights → Cache → Response

## 🧱 Architecture

- User: soc_code, msa
- UserProfile: skills, salary
- UserData: city, state

## 🧩 Services

- UserAggregateService
- ProfileService
- CareerService
- Redis Cache
- LLM Service

## 🌐 Endpoint

GET /career/intelligence/{user_id}

## 📦 Response

Includes charts, metrics, missing skills, and insights.

## ⚙️ Optimizations

- Async calls
- Redis caching

## 🔐 Security

User validation enforced.

## 🎯 Summary

Raw Data → Context → Intelligence → Visualization → Insight
