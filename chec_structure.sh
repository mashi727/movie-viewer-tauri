# Tauriプロジェクトの構造を確認するコマンド

# 1. 現在のディレクトリ構造を確認
echo "=== プロジェクト構造 ==="
ls -la

# 2. tauri.conf.jsonの設定を確認（どこにフロントエンドファイルがあるかを確認）
echo -e "\n=== tauri.conf.json の distDir 設定を確認 ==="
if [ -f "src-tauri/tauri.conf.json" ]; then
    grep -A 5 -B 5 "distDir\|devPath" src-tauri/tauri.conf.json
else
    echo "src-tauri/tauri.conf.json が見つかりません"
fi

# 3. HTMLファイルの場所を確認
echo -e "\n=== HTMLファイルの場所 ==="
find . -name "*.html" -not -path "./node_modules/*" -not -path "./target/*"

# 4. 既存のJavaScriptファイルを確認
echo -e "\n=== 既存のJavaScriptファイル ==="
find . -name "*.js" -not -path "./node_modules/*" -not -path "./target/*" -not -path "./src-tauri/target/*"

# 5. package.jsonがあるか確認
echo -e "\n=== package.json の存在確認 ==="
if [ -f "package.json" ]; then
    echo "package.json が見つかりました"
    echo "scripts セクション:"
    grep -A 10 '"scripts"' package.json 2>/dev/null || echo "scripts セクションが見つかりません"
else
    echo "package.json が見つかりません"
fi

echo -e "\n=== 推奨されるファイル配置 ==="
echo "tauri.conf.json の設定に基づいて、以下の場所にファイルを配置してください："
echo ""
echo "1. distDir が '../dist' の場合:"
echo "   - dist/index.html"
echo "   - dist/main.js"
echo ""
echo "2. distDir が '../src' の場合:"
echo "   - src/index.html" 
echo "   - src/main.js"
echo ""
echo "3. distDir が '.' または '../' の場合:"
echo "   - index.html (プロジェクトルート)"
echo "   - main.js (プロジェクトルート)"