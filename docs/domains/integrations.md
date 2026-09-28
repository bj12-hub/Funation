# Platform Integrations

Confirmed:

```text
PlatformAdapter
├── YouTubeAdapter
├── FlexTVAdapter
└── SoopAdapter
```

Adapters isolate external API authentication, DTOs, events, errors and capability differences.

The core donation domain must not depend directly on external platform SDK types.
