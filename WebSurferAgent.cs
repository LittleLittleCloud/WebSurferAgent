using AutoGen.Core;
using AutoGen.OpenAI;
using AutoGen.OpenAI.Extension;
using Microsoft.Playwright;
using OpenAI.Chat;
using System.Text;
using System.Text.Json;

namespace webSurferAgent;

public partial class WebSurferAgent : IAgent
{
    private readonly IAgent _agent;
    private readonly IBrowser _browser;
    private readonly IPage _page;
    private readonly int _maxSteps = 10;
    private TagMetaDatas? _interactiveElements = null;

    internal WebSurferAgent(IAgent agent, IBrowser browser, int maxSteps = 10)
    {
        _agent = agent;
        _browser = browser;

        // to google
        _page = browser.NewPageAsync().Result;
        _page.GotoAsync("https://www.google.com").Wait();
        DrawAllInteractiveElementsAsync().Wait();
    }

    public WebSurferAgent(ChatClient openaiClient, IBrowser browser, string name = "web-surfur", int maxSteps = 10)
    {
        var functionCallMiddleware = new FunctionCallMiddleware(
            functions: [
                //this.VisitUrlFunctionContract,
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
                //[nameof(VisitUrl)] = this.VisitUrlWrapper,
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
        // to google
        _page = browser.NewPageAsync().Result;
        _page.GotoAsync("https://www.google.com").Wait();
        DrawAllInteractiveElementsAsync().Wait();
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
            var availableInteractionStringBuilder = new StringBuilder();
            availableInteractionStringBuilder.AppendLine("Available interactive elements:");
            foreach (var rect in _interactiveElements?.Data ?? Array.Empty<TagMetadata>())
            {
                if (string.IsNullOrEmpty(rect.AriaLabel))
                {
                    continue;
                }

                availableInteractionStringBuilder.AppendLine($"id: {rect.Label}, aria-name: {rect.AriaLabel}");
            }

            var availableInteractionMessage = new TextMessage(Role.User, availableInteractionStringBuilder.ToString());

            var chatHistoryWithAvailableInteractions = new List<IMessage>(chatHistory)
            {
                availableInteractionMessage
            };

            var reply = await _agent.GenerateReplyAsync(chatHistoryWithAvailableInteractions, options, cancellationToken);
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

    //[Function]
    //public async Task<string> VisitUrl(string url)
    //{
    //    await _page.GotoAsync(url);
    //    await DrawAllInteractiveElementsAsync();

    //    return await _page.TitleAsync();
    //}

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
    /// Click on an interactive element with the given id. The interactive elements are marked with red label and starts with @. e.g. @1
    /// </summary>
    /// <param name="id">the id of the interactive element. It is marked with @.</param>
    [Function]
    public async Task<string> Click(string id)
    {
        var interactiveElement = _interactiveElements?.Data.FirstOrDefault(e => e.Label == id);

        if (interactiveElement == null)
        {
            return $"Element with id {id} not found, maybe it's not in the viewport";
        }

        try
        {
            var xPath = interactiveElement.XPath;
            var target = _page.Locator(xPath);
            await target.ScrollIntoViewIfNeededAsync();
            await target.ClickAsync();

            await DrawAllInteractiveElementsAsync();

            return $"Clicked on element with id {id}";
        }
        catch (PlaywrightException ex) when (ex.Message.Contains("Element is an <input>, <textarea> or [contenteditable] element"))
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

    /// <summary>
    /// Type the given text on the interactive element with the given id.
    /// </summary>
    /// <param name="id">The id of the interactive element, the label of the element starts with #. e.g. #1</param>
    [Function]
    public async Task<string> Type(string id, string text)
    {
        var interactiveElement = _interactiveElements?.Data.FirstOrDefault(e => e.Label == id);

        if (interactiveElement == null)
        {
            return $"Element with id {id} not found, maybe it's not in the viewport";
        }

        try
        {
            var xPath = interactiveElement.XPath;
            var target = _page.Locator(xPath);
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
        //await DrawAllInteractiveElementsAsync();
        return "PageUp";
    }

    [Function]
    public async Task<string> PageDown()
    {
        await _page.Keyboard.PressAsync("PageDown");
        //await DrawAllInteractiveElementsAsync();
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
        var scriptPath = "tag_utils.js";
        var script = File.ReadAllText(scriptPath);
        await _page.EvaluateAsync(script);

        //var initialize_script = "initialize_script.js";
        //var initializeScript = File.ReadAllText(initialize_script);
        //await _page.EvaluateAsync(initializeScript);
        await _page.WaitForLoadStateAsync();
        var objects = await _page.EvaluateAsync("window.tagifyWebpage();");
        var str = JsonSerializer.Serialize(objects);
        _interactiveElements = JsonSerializer.Deserialize<TagMetaDatas>(str) ?? throw new Exception("interactiveRects is null");
        //var interactiveElements = 
        //var str = JsonSerializer.Serialize(interactiveElements);
        //_interactiveElements = JsonSerializer.Deserialize<InteractiveRectangles>(str) ?? throw new Exception("interactiveRects is null");

        //// print all text content
        //foreach (var rect in _interactiveElements.Rects)
        //{
        //    Console.WriteLine($"id: {rect.ElementId}, tag: {rect.TagName}, role: {rect.Role}, aria-name: {rect.AriaName}");
        //}
    }
}
