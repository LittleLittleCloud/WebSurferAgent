using AutoGen.Core;
using Azure.AI.OpenAI;
using Microsoft.Playwright;
using System.Text.Json;
using System.Text.Json.Serialization;
using webSurfurAgent;

using var playwright = await Playwright.CreateAsync();
await using var browser = await playwright.Chromium.LaunchAsync(new ()
{
    Headless = false,
    SlowMo = 500,
});

var aoaiEndpoint = Environment.GetEnvironmentVariable("AZURE_OPENAI_ENDPOINT") ?? throw new Exception("AZURE_OPENAI_ENDPOINT is not set");
var aoaiKey = Environment.GetEnvironmentVariable("AZURE_OPENAI_API_KEY") ?? throw new Exception("AZURE_OPENAI_KEY is not set");

var openaiClient = new AzureOpenAIClient(new Uri(aoaiEndpoint), new Azure.AzureKeyCredential(aoaiKey));
var webSurferAgent = new WebSurfurAgent(openaiClient.GetChatClient("gpt-4o"), browser);
var task = """
    Can I disable parallel function call in gpt-4o? 
    """;
await webSurferAgent.SendAsync(task);

//var page = await browser.NewPageAsync();
//await page.GotoAsync("https://playwright.dev/dotnet");

//// evaluate the page
//var scriptPath = "page_script.js";
//var script = File.ReadAllText(scriptPath);
//await page.EvaluateAsync(script);

//var interactiveRects = await page.EvaluateAsync<InteractiveRectangles>("MultimodalWebSurfer.getInteractiveRects();");
//var visualViewport = await page.EvaluateAsync<VisualViewport>("MultimodalWebSurfer.getVisualViewport();");
//var drawRects = await page.EvaluateAsync<Rectangle[]>("MultimodalWebSurfer.drawVisibleInteractiveRects();");
//Console.WriteLine($"Interactive element count: {interactiveRects.Rects.Count()}");

//Console.WriteLine($"Visual viewport: {JsonSerializer.Serialize(visualViewport)}");

//// save a screenshot
//await page.ScreenshotAsync(new PageScreenshotOptions { Path = "screenshot.png" });

public class Element
{
    [JsonPropertyName("$id")]
    public string Id { get; set; } = null!;
}

public class Rectangle : Element
{
    [JsonPropertyName("x")]
    public double X { get; set; }

    [JsonPropertyName("y")]
    public double Y { get; set; }

    [JsonPropertyName("width")]
    public double Width { get; set; }

    [JsonPropertyName("height")]
    public double Height { get; set; }

    [JsonPropertyName("top")]
    public double Top { get; set; }

    [JsonPropertyName("right")]
    public double Right { get; set; }

    [JsonPropertyName("bottom")]
    public double Bottom { get; set; }

    [JsonPropertyName("left")]
    public double Left { get; set; }

    [JsonPropertyName("element_id")]
    public string ElementId { get; set; } = null!;

    [JsonPropertyName("interactive_id")]
    public int InteractiveId { get; set; }

    [JsonPropertyName("content")]
    public string Content { get; set; } = null!;
}

public class InteractiveRectangle : Element
{
    [JsonPropertyName("tag_name")]
    public string TagName { get; set; } = null!;

    [JsonPropertyName("role")]
    public string Role { get; set; } = null!;

    [JsonPropertyName("aria-name")]
    public string AriaName { get; set; } = null!;

    [JsonPropertyName("v-scrollable")]
    public bool VScrollable { get; set; }

    [JsonPropertyName("rects")]
    public Rectangle[] Rects { get; set; } = Array.Empty<Rectangle>();
}

public class InteractiveRectangles : Element
{
    [JsonPropertyName("rects")]
    public InteractiveRectangle[] Rects { get; set; } = Array.Empty<InteractiveRectangle>();
}

public class VisualViewport : Element
{
    [JsonPropertyName("width")]
    public double Width { get; set; }

    [JsonPropertyName("height")]
    public double Height { get; set; }

    [JsonPropertyName("offsetTop")]
    public double OffsetTop { get; set; }

    [JsonPropertyName("offsetLeft")]
    public double OffsetLeft { get; set; }

    [JsonPropertyName("pageTop")]
    public double PageTop { get; set; }

    [JsonPropertyName("pageLeft")]
    public double PageLeft { get; set; }

    [JsonPropertyName("scale")]
    public double Scale { get; set; }

    [JsonPropertyName("clientWidth")]
    public double ClientWidth { get; set; }

    [JsonPropertyName("clientHeight")]
    public double ClientHeight { get; set; }

    [JsonPropertyName("scrollWidth")]
    public double ScrollWidth { get; set; }

    [JsonPropertyName("scrollHeight")]
    public double ScrollHeight { get; set; }
}

