using AutoGen.Core;
using Azure.AI.OpenAI;
using Microsoft.Playwright;
using webSurferAgent;
using Microsoft.Extensions.Hosting;
using ChatRoom.SDK;
using Microsoft.Extensions.DependencyInjection;

var roomConfig = new RoomConfiguration
{
    Room = "room",
    Port = 30000,
    Timeout = 120,
};

var yourName = "User";

var serverConfig = new ChatRoomServerConfiguration
{
    RoomConfig = roomConfig,
    YourName = yourName,
    ServerConfig = new ServerConfiguration
    {
        Urls = "http://localhost:50001",
    },
};

using var host = Host.CreateDefaultBuilder()
    .UseChatRoomServer(serverConfig)
    .Build();

await host.StartAsync();

var client = host.Services.GetRequiredService<ChatPlatformClient>();

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

await client.RegisterAutoGenAgentAsync(webSurferAgent, "web surfer agent");

// create a channel to talk to web surfer agent
// remmeber to add your name to the channel so that the agent can talk to you
await client.CreateChannel("web surfer channel", [webSurferAgent.Name, yourName], orchestrators: ["RoundRobin"]);

await host.WaitForShutdownAsync();
