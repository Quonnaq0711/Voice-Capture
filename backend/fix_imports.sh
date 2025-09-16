#!/bin/bash

echo "Fixing all imports to absolute paths..."

# Remove all relative import dots
for file in $(find . -name "*.py" -type f); do
    # Fix two-dot imports (from ..module)
    sed -i 's/from \.\.services\./from services./g' "$file"
    sed -i 's/from \.\.api\./from api./g' "$file"
    sed -i 's/from \.\.db\./from db./g' "$file"
    sed -i 's/from \.\.models\./from models./g' "$file"
    sed -i 's/from \.\.utils\./from utils./g' "$file"
    sed -i 's/from \.\.scripts\./from scripts./g' "$file"
    
    # Fix one-dot imports (from .module)
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
done

echo "Checking for remaining relative imports..."
remaining=$(grep -r "from \.\." . --include="*.py" | wc -l)
if [ $remaining -eq 0 ]; then
    echo "All relative imports fixed!"
else
    echo "Still found $remaining relative imports:"
    grep -r "from \.\." . --include="*.py"
fi
