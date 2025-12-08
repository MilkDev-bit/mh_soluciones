name: Deploy to Railway

on:
  push:
    branches: [main, develop]

jobs:
  detect-changes:
    runs-on: ubuntu-latest
    outputs:
      backend-changed: ${{ steps.changes. outputs.backend }}
      frontend-changed: ${{ steps.changes.outputs.frontend }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Detect file changes
        id: changes
        run: |
          if git diff --name-only origin/main HEAD | grep -q "^backend/"; then
            echo "backend=true" >> $GITHUB_OUTPUT
          else
            echo "backend=false" >> $GITHUB_OUTPUT
          fi
          
          if git diff --name-only origin/main HEAD | grep -q "^frontend/"; then
            echo "frontend=true" >> $GITHUB_OUTPUT
          else
            echo "frontend=false" >> $GITHUB_OUTPUT
          fi

  deploy-backend:
    needs: detect-changes
    if: needs.detect-changes.outputs.backend-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy Backend to Railway
        run: |
          echo "🚀 Desplegando SOLO backend..."
          # Railway CLI deploy - solo backend
          npx railway up --service backend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}

  deploy-frontend:
    needs: detect-changes
    if: needs.detect-changes.outputs. frontend-changed == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy Frontend to Railway
        run: |
          echo "🚀 Desplegando SOLO frontend..."
          # Railway CLI deploy - solo frontend
          npx railway up --service frontend
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
