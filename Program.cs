using AutoGen.Core;
using Azure.AI.OpenAI;
using Microsoft.Playwright;
using webSurferAgent;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync(new()
{
    Headless = false,
    SlowMo = 500,
});

var aoaiEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT") ?? throw new Exception("AZURE_OPENAI_ENDPOINT is not set");
var aoaiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY") ?? throw new Exception("AZURE_OPENAI_KEY is not set");

var openaiClient = new AzureOpenAIClient(new Uri(aoaiEndpoint), new Azure.AzureKeyCredential(aoaiKey));
var webSurferAgent = new WebSurferAgent(openaiClient.GetChatClient("gpt-4o"), browser);
var task = """
    Can I disable parallel function call in gpt-4o? 
    """;
await webSurferAgent.SendAsync(task);
