#!/bin/bash

# Script to prepare FFmpeg Lambda Layer from downloaded static binaries
# Takes ffmpeg-release-arm64-static.tar.xz and creates ffmpeg-layer.zip

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TAR_FILE="$SCRIPT_DIR/ffmpeg-release-arm64-static.tar.xz"
LAYER_DIR="$SCRIPT_DIR/ffmpeg-layer"
OUTPUT_ZIP="$SCRIPT_DIR/ffmpeg-layer.zip"

echo "🎬 Preparing FFmpeg Lambda Layer..."

# Check if the tar file exists
if [ ! -f "$TAR_FILE" ]; then
    echo "❌ Error: $TAR_FILE not found!"
    echo ""
    echo "Please download the file from:"
    echo "https://johnvansickle.com/ffmpeg/ - ffmpeg-release-arm64-static.tar.xz"
    echo ""
    echo "Save it as: $TAR_FILE"
    exit 1
fi

# Clean up any existing layer directory
if [ -d "$LAYER_DIR" ]; then
    echo "🧹 Cleaning up existing layer directory..."
    rm -rf "$LAYER_DIR"
fi

# Remove existing zip file
if [ -f "$OUTPUT_ZIP" ]; then
    echo "🧹 Removing existing zip file..."
    rm -f "$OUTPUT_ZIP"
fi

# Create layer directory structure
echo "📁 Creating layer directory structure..."
mkdir -p "$LAYER_DIR/bin"

# Extract the tar file
echo "📦 Extracting ffmpeg binaries..."
tar -xf "$TAR_FILE" --strip-components=1 -C "$LAYER_DIR"

# Move binaries to the bin directory (Lambda layer convention)
echo "🔧 Moving binaries to bin/ directory..."
mv "$LAYER_DIR/ffmpeg" "$LAYER_DIR/bin/"
mv "$LAYER_DIR/ffprobe" "$LAYER_DIR/bin/"

# Optional: Keep only essential files to reduce layer size
echo "🗑️  Removing unnecessary files to reduce layer size..."
rm -rf "$LAYER_DIR/manpages"
rm -f "$LAYER_DIR/qt-faststart"
rm -f "$LAYER_DIR/readme.txt"
rm -f "$LAYER_DIR/GPLv3.txt"

# Create the zip file
echo "🗜️  Creating Lambda layer zip file..."
cd "$SCRIPT_DIR"
zip -r "ffmpeg-layer.zip" ffmpeg-layer/

# Clean up the temporary directory
echo "🧹 Cleaning up temporary files..."
rm -rf "$LAYER_DIR"

# Verify the zip file was created and show size
if [ -f "$OUTPUT_ZIP" ]; then
    FILE_SIZE=$(ls -lh "$OUTPUT_ZIP" | awk '{print $5}')
    echo ""
    echo "✅ FFmpeg Lambda Layer created successfully!"
    echo "📁 File: $OUTPUT_ZIP"
    echo "📏 Size: $FILE_SIZE"
    echo ""
    echo "🚀 Ready for deployment with Terraform!"
else
    echo "❌ Error: Failed to create zip file"
    exit 1
fi