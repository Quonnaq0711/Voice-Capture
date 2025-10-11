#!/bin/bash

echo "=== Fixing Backend Imports ==="
cd backend

# Fix relative imports in backend (excluding personal_assistant)
for file in $(find . -name "*.py" -type f ! -path "./personal_assistant/*"); do
    # Fix two-dot imports
    sed -i 's/from \.\.services\./from services./g' "$file"
    sed -i 's/from \.\.api\./from api./g' "$file"
    sed -i 's/from \.\.db\./from db./g' "$file"
    sed -i 's/from \.\.models\./from models./g' "$file"
    sed -i 's/from \.\.utils\./from utils./g' "$file"
    sed -i 's/from \.\.scripts\./from scripts./g' "$file"
    
    # Fix one-dot imports
    sed -i 's/from \.services\./from services./g' "$file"
    sed -i 's/from \.api\./from api./g' "$file"
    sed -i 's/from \.db\./from db./g' "$file"
    sed -i 's/from \.models\./from models./g' "$file"
    sed -i 's/from \.utils\./from utils./g' "$file"
    
    # Fix imports without trailing dot
    sed -i 's/from \.\.services /from services /g' "$file"
    sed -i 's/from \.\.api /from api /g' "$file"
    sed -i 's/from \.\.db /from db /g' "$file"
    sed -i 's/from \.\.models /from models /g' "$file"
    sed -i 's/from \.\.utils /from utils /g' "$file"
    sed -i 's/from \.services /from services /g' "$file"
    sed -i 's/from \.api /from api /g' "$file"
    sed -i 's/from \.db /from db /g' "$file"
    sed -i 's/from \.models /from models /g' "$file"
    sed -i 's/from \.utils /from utils /g' "$file"
    
    # Remove backend. prefix (for Docker flat structure)
    sed -i 's/from backend\.services\./from services./g' "$file"
    sed -i 's/from backend\.api\./from api./g' "$file"
    sed -i 's/from backend\.db\./from db./g' "$file"
    sed -i 's/from backend\.models\./from models./g' "$file"
    sed -i 's/from backend\.utils\./from utils./g' "$file"
    sed -i 's/from backend\.services /from services /g' "$file"
    sed -i 's/from backend\.api /from api /g' "$file"
    sed -i 's/from backend\.db /from db /g' "$file"
    sed -i 's/from backend\.models /from models /g' "$file"
    sed -i 's/from backend\.utils /from utils /g' "$file"
done

echo "=== Fixing Personal Assistant Imports ==="

# Fix PA-specific imports
for file in $(find personal_assistant -name "*.py" -type f); do
    # Remove personal_assistant. prefix
    sed -i 's/from personal_assistant\./from /g' "$file"
    
    # Remove backend.personal_assistant. prefix
    sed -i 's/from backend\.personal_assistant\./from /g' "$file"
    
    # Fix relative imports to flat imports
    sed -i 's/from \.\./from /g' "$file"
    sed -i 's/from \./from /g' "$file"
    
    # Fix imports to parent backend modules (db, models, etc)
    sed -i 's/from backend\.db\./from db./g' "$file"
    sed -i 's/from backend\.models\./from models./g' "$file"
    sed -i 's/from backend\.utils\./from utils./g' "$file"
done

cd ..

echo ""
echo "=== Checking for Remaining Issues ==="

# Check backend
echo "Backend relative imports:"
backend_relative=$(grep -r "from \.\." backend --include="*.py" ! -path "*/personal_assistant/*" | wc -l)
echo "  Found: $backend_relative"

echo "Backend 'backend.' imports:"
backend_prefix=$(grep -r "from backend\." backend --include="*.py" ! -path "*/personal_assistant/*" | wc -l)
echo "  Found: $backend_prefix"

# Check PA
echo "PA 'personal_assistant.' imports:"
pa_prefix=$(grep -r "from personal_assistant\." backend/personal_assistant --include="*.py" | wc -l)
echo "  Found: $pa_prefix"

echo "PA 'backend.' imports:"
pa_backend=$(grep -r "from backend\." backend/personal_assistant --include="*.py" | wc -l)
echo "  Found: $pa_backend"

echo "PA relative imports:"
pa_relative=$(grep -r "from \." backend/personal_assistant --include="*.py" | wc -l)
echo "  Found: $pa_relative"

echo ""
if [ $backend_relative -eq 0 ] && [ $backend_prefix -eq 0 ] && [ $pa_prefix -eq 0 ] && [ $pa_backend -eq 0 ] && [ $pa_relative -eq 0 ]; then
    echo "✅ All imports fixed!"
else
    echo "⚠️  Some imports still need attention:"
    [ $backend_relative -gt 0 ] && grep -r "from \.\." backend --include="*.py" ! -path "*/personal_assistant/*"
    [ $backend_prefix -gt 0 ] && grep -r "from backend\." backend --include="*.py" ! -path "*/personal_assistant/*"
    [ $pa_prefix -gt 0 ] && grep -r "from personal_assistant\." backend/personal_assistant --include="*.py"
    [ $pa_backend -gt 0 ] && grep -r "from backend\." backend/personal_assistant --include="*.py"
    [ $pa_relative -gt 0 ] && grep -r "from \." backend/personal_assistant --include="*.py"
fi

echo ""
echo "Run: docker-compose -f docker-compose.staging.yml up -d --build"
