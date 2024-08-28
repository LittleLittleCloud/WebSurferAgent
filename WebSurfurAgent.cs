using AutoGen.Core;
using AutoGen.OpenAI;
using AutoGen.OpenAI.Extension;
using Azure.AI.OpenAI;
using Microsoft.Playwright;
using OpenAI;
using OpenAI.Chat;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace webSurferAgent;

public partial class WebSurferAgent : IAgent
{
    private readonly IAgent _agent;
    private readonly IBrowser _browser;
    private readonly IPage _page;
    private readonly int _maxSteps = 10;

    internal WebSurferAgent(IAgent agent, IBrowser browser, int maxSteps = 10)
    {
        _agent = agent;
        _browser = browser;
        _page = browser.NewPageAsync().Result;
    }

    public WebSurferAgent(ChatClient openaiClient, IBrowser browser, string name = "web-surfur", int maxSteps = 10)
    {
        var functionCallMiddleware = new FunctionCallMiddleware(
            functions: [
                this.VisitUrlFunctionContract,
                this.TypeFunctionContract,
                this.HistoryBackFunctionContract,
                this.ClickFunctionContract,
                this.PageDownFunctionContract,
                this.PageUpFunctionContract,
                this.SearchGoogleFunctionContract,
                this.EnterFunctionContract,
                ],
            functionMap: new Dictionary<string, Func<string, Task<string>>>
            {
                [nameof(VisitUrl)] = this.VisitUrlWrapper,
                [nameof(HistoryBack)] = this.HistoryBackWrapper,
                [nameof(Click)] = this.ClickWrapper,
                [nameof(Type)] = this.TypeWrapper,
                [nameof(PageDown)] = this.PageDownWrapper,
                [nameof(PageUp)] = this.PageUpWrapper,
                [nameof(SearchGoogle)] = this.SearchGoogleWrapper,
                [nameof(Enter)] = this.EnterWrapper,
            });

        _agent = new OpenAIChatAgent(
            chatClient: openaiClient,
            name: name)
            .RegisterMessageConnector()
            .RegisterMiddleware(functionCallMiddleware)
            .RegisterPrintMessage();


        _browser = browser;
        _page = browser.NewPageAsync().Result;
    }

    public string Name => _agent.Name;

    public async Task<IMessage> GenerateReplyAsync(IEnumerable<IMessage> messages, GenerateReplyOptions? options = null, CancellationToken cancellationToken = default)
    {
        var taskPrompt = """
            summarize the task from chat history.
            """;

        var task = await _agent.SendAsync(taskPrompt, messages);

        var remainingSteps = _maxSteps;
        var prompt = $"""
            Resolve the given task by browsing the web. Suggest one step at each time. Use page up or page down when the page is not fully visible.

            # Task
            {task.GetContent() ?? throw new Exception("task is empty")}

            If you gather enough information to answer the task, you can stop browsing and provide the answer using the following format
            ```answer
            // your answer
            ```
            """;

        var promptMessage = new TextMessage(Role.User, prompt);

        var chatHistory = new List<IMessage>()
        {
            promptMessage
        };
        while (remainingSteps > 0)
        {
            var pageSnapshot = await _page.ScreenshotAsync(new PageScreenshotOptions { Path = "screenshot.png" });
            var image = File.ReadAllBytes("screenshot.png");
            var imageMessage = new ImageMessage(Role.User, BinaryData.FromBytes(image, mediaType: "image/png"));
            chatHistory.Add(imageMessage);

            var reply = await _agent.GenerateReplyAsync(chatHistory, options, cancellationToken);
            if (reply is ToolCallAggregateMessage toolCallMessage)
            {
                chatHistory.Add(reply);
                reply = await _agent.SendAsync(toolCallMessage, chatHistory, ct: cancellationToken);
            }

            chatHistory.Add(reply);
            remainingSteps--;

            if (reply.GetContent()?.Contains("```answer") is true)
            {
                return reply;
            }
        }

        return new TextMessage(Role.Assistant, "I couldn't find the answer in the given steps.", this.Name);
    }

    // browser action

    [Function]
    public async Task<string> VisitUrl(string url)
    {
        await _page.GotoAsync(url);
        await DrawAllInteractiveElementsAsync();

        return await _page.TitleAsync();
    }

    [Function]
    public async Task<string> HistoryBack()
    {
        await _page.GoBackAsync();
        await DrawAllInteractiveElementsAsync();
        return await _page.TitleAsync();
    }

    /// <summary>
    /// Hit the Enter key on the keyboard.
    /// </summary>
    [Function]
    public async Task<string> Enter()
    {

       await _page.Keyboard.PressAsync("Enter");
        await DrawAllInteractiveElementsAsync();
        return "Enter key pressed";
    }

    /// <summary>
    /// Click on an interactive element with the given id. The interactive elements are marked in red rectangles.
    /// </summary>
    /// <param name="id">the id of the interactive element, it always located at the left bottom of the element</param>
    [Function]
    public async Task<string> Click(int id)
    {
        var interactiveElements = await _page.EvaluateAsync("MultimodalWebSurfer.getInteractiveRects();");
        var str = JsonSerializer.Serialize(interactiveElements);
        var interactiveRects = JsonSerializer.Deserialize<InteractiveRectangles>(str) ?? throw new Exception("interactiveRects is null");
        //var interactiveElements = await _page.EvaluateAsync<InteractiveRectangles>("MultimodalWebSurfer.getInteractiveRects();");


        //Console.WriteLine(JsonSerializer.Serialize(interactiveElements, new JsonSerializerOptions { WriteIndented = true }));
        var interactiveElement = interactiveRects.Rects.SelectMany(r => r.Rects).FirstOrDefault(e => e.InteractiveId == id);

        // print all text content
        foreach (var rect in interactiveRects.Rects.SelectMany(r => r.Rects))
        {
            Console.WriteLine(rect.Content);
        }

        if (interactiveElement == null)
        {
            return $"Element with id {id} not found, maybe it's not in the viewport";
        }

        try
        {
            var target = _page.Locator($"[__elementId='{interactiveElement.ElementId}']");
            await target.ScrollIntoViewIfNeededAsync();
            await target.ClickAsync();

            await DrawAllInteractiveElementsAsync();

            return $"Clicked on element with id {id}";
        }
        catch(PlaywrightException ex) when (ex.Message.Contains("Element is an <input>, <textarea> or [contenteditable] element"))
        {
            return $"Element with id {id} is not clickable";
        }
        catch (PlaywrightException ex) when (ex.Message.Contains("Element is not visible"))
        {
            return $"Element with id {id} is not visible";
        }
    }

    [Function]
    public async Task<string> VisitGoogle()
    {
        await _page.GotoAsync("https://www.google.com");
        // sleep for a while to let the page load
        await DrawAllInteractiveElementsAsync();
        return "You are now on Google";
    }

    [Function]
    public async Task<string> SearchGoogle(string query)
    {
        var encodedQuery = Uri.EscapeDataString(query);
        await _page.GotoAsync($"https://www.google.com/search?q={encodedQuery}");

        await Task.Delay(2000);

        await DrawAllInteractiveElementsAsync();

        return $"You searched for {query}";
    }

    [Function]
    public async Task<string> Type(int id, string text)
    {
        var interactiveElements = await _page.EvaluateAsync("MultimodalWebSurfer.getInteractiveRects();");
        var str = JsonSerializer.Serialize(interactiveElements);
        var interactiveRects = JsonSerializer.Deserialize<InteractiveRectangles>(str) ?? throw new Exception("interactiveRects is null");
        var interactiveElement = interactiveRects.Rects.SelectMany(r => r.Rects).FirstOrDefault(e => e.InteractiveId == id);

        if (interactiveElement == null)
        {
            return $"Element with id {id} not found, maybe it's not in the viewport";
        }

        try
        {
            var target = _page.Locator($"[__elementId='{interactiveElement.ElementId}']");
            await target.ScrollIntoViewIfNeededAsync();
            await target.FillAsync(text);

            await DrawAllInteractiveElementsAsync();

            return $"Typed {text} on element with id {id}";
        }
        catch (PlaywrightException ex) when (ex.Message.Contains("Element is not an <input>, <textarea> or [contenteditable] element"))
        {
            return $"Element with id {id} is not a text input";
        }
    }

    [Function]
    public async Task<string> PageUp()
    {
        await _page.Keyboard.PressAsync("PageUp");
        await DrawAllInteractiveElementsAsync();
        return "PageUp";
    }

    [Function]
    public async Task<string> PageDown()
    {
        await _page.Keyboard.PressAsync("PageDown");
        await DrawAllInteractiveElementsAsync();
        return "PageDown";
    }

    ///// <summary>
    ///// Convert the current page to markdown format.
    ///// </summary>
    //[Function]
    //public async Task<string> ToMarkdown()
    //{

    //}

    private async Task DrawAllInteractiveElementsAsync()
    {
        var scriptPath = "page_script.js";
        var script = File.ReadAllText(scriptPath);
        await _page.EvaluateAsync(script);
        await _page.EvaluateAsync("MultimodalWebSurfer.drawVisibleInteractiveRects();");
    }
}
