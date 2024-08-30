using System.Text.Json.Serialization;

namespace webSurferAgent;

public class Element
{
    [JsonPropertyName("$id")]
    public string Id { get; set; } = null!;
}

public class TagMetadata : Element
{
    [JsonPropertyName("ariaLabel")]
    public string? AriaLabel { get; set; }

    [JsonPropertyName("xpath")]
    public string XPath { get; set; } = null!;

    [JsonPropertyName("textNodeIndex")]
    public int? TextNodeIndex { get; set; } = null;

    [JsonPropertyName("label")]
    public string Label { get; set; }
}

public class TagMetaDatas : Element
{
    [JsonPropertyName("data")]
    public TagMetadata[] Data { get; set; } = Array.Empty<TagMetadata>();
}
