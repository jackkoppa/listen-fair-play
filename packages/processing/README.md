# processing

TODO: Implement bundling for lambdas, to bundle all required npm dependencies into one large file. 

The resulting structure should look like this:

/packages/processing/
├── aws-dist
│   ├── lambda-1
│   │    ├── retrieve-rss-feeds-and-download-audio-files.min.js
│   ├── lambda-2
│   │    ├── process-new-audio-files-via-whisper.min.js
│   ├── lambda-2
│   │    ├── convert-srt-files-into-search-entries.min.js

Each of these .js files should be a single file, and should have all necessary `dependencies` bundled.

We'll use rollup to do so. These will be built using the `pnpm build:dev` command.



---


> [!NOTE]  
> See [/diagrams](../../../diagrams/README.md) for details on how these Lambdas interact when deployed


* [lambda-1](./lambda-1/) - retrieve-rss-feeds-and-download-audio-files.ts
* [lambda-2](./lambda-2/) - process-new-audio-files-via-whisper.ts
* [lambda-3](./lambda-3/) - convert-srt-files-into-search-entries.ts