#!/bin/bash

# Tauri Movie Viewer Setup Helper

echo "Setting up Tauri Movie Viewer..."

# Check for Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js is not installed. Please install Node.js v16 or later."
    exit 1
fi

# Check for Rust
if ! command -v rustc &> /dev/null; then
    echo "Rust is not installed. Installing via rustup..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
    source $HOME/.cargo/env
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Check for icon file
if [ ! -f "icon.png" ]; then
    echo "WARNING: No icon.png file found in current directory."
    echo "Please add your icon file and run: npm run tauri icon icon.png"
else
    echo "Generating icons..."
    npm run tauri icon icon.png
fi

echo "Setup complete! You can now run:"
echo "  npm run tauri dev    # For development"
echo "  npm run tauri build  # For production build"
