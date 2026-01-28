#!/bin/bash
curl -s -X POST http://localhost:3001/api/workers/personal-thought/run-once \
  -H "Content-Type: application/json" \
  -d '{}'
