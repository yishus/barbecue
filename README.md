# barbecue

Barbecue is a tool for structured AI workflows, inspired by [Roast](https://github.com/Shopify/roast).

Workflows are defined using JSON, example:

```
{
    tools: ["getLatLng", "getWeather"],
    steps: [
        "What is the weather in London today?"
    ]
}
```

## Features

- Tool use (grep, read file, search files)
- Workflow and step prompts
- Output template
- Custom step

[Blog post](https://yishus.dev/roast/#replicating-roast)
