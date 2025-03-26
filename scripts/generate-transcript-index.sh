#!/bin/bash

# Script to generate an index.json file for transcript files

echo "Generating transcript index file..."

# Create the destination directories if they don't exist
mkdir -p client/dist/assets/transcripts
mkdir -p client/public/assets/transcripts

# Get a list of all .srt files recursively in the processing/transcripts directory
# Exclude README.md files
find processing/transcripts -type f -name "*.srt" | sort > /tmp/transcript_files.txt

# Prepare JSON structure with file paths
echo "{" > /tmp/transcript_index.json
echo "  \"files\": [" >> /tmp/transcript_index.json

# Process each file in the list
first_file=true
while IFS= read -r file_path; do
  # Extract the filename from the path
  filename=$(basename "$file_path")
  
  # Add comma for all but the first item
  if [ "$first_file" = true ]; then
    first_file=false
  else
    echo "," >> /tmp/transcript_index.json
  fi
  
  # Add the filename to the JSON array
  echo "    \"$filename\"" >> /tmp/transcript_index.json
done < /tmp/transcript_files.txt

# Close the JSON structure
echo "  ]" >> /tmp/transcript_index.json
echo "}" >> /tmp/transcript_index.json

# Move the index file to the client's assets directories
cp /tmp/transcript_index.json client/dist/assets/transcripts/index.json
cp /tmp/transcript_index.json client/public/assets/transcripts/index.json

echo "Transcript index file generated at:"
echo "- client/dist/assets/transcripts/index.json"
echo "- client/public/assets/transcripts/index.json" 