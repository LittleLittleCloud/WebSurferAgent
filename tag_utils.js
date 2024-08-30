"use strict";
const tarsierId = "__tarsier_id";
const tarsierDataAttribute = "data-tarsier-id";
const tarsierSelector = `#${tarsierId}`;
const reworkdVisibilityAttribute = "reworkd-original-visibility";
const elIsVisible = (el) => {
    const rect = el.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(el);
    const isHidden = computedStyle.visibility === "hidden" ||
        computedStyle.display === "none" ||
        el.hidden ||
        (el.hasAttribute("disabled") && el.getAttribute("disabled"));
    const has0Opacity = computedStyle.opacity === "0";
    // Often input elements will have 0 opacity but still have some interactable component
    const isTransparent = has0Opacity && !hasLabel(el);
    const isDisplayContents = computedStyle.display === "contents";
    const isZeroSize = (rect.width === 0 || rect.height === 0) && !isDisplayContents; // display: contents elements have 0 width and height
    const isScriptOrStyle = el.tagName === "SCRIPT" || el.tagName === "STYLE";
    return !isHidden && !isTransparent && !isZeroSize && !isScriptOrStyle;
};
function hasLabel(element) {
    const tagsThatCanHaveLabels = ["input", "textarea", "select", "button"];
    if (!tagsThatCanHaveLabels.includes(element.tagName.toLowerCase())) {
        return false;
    }
    const escapedId = CSS.escape(element.id);
    const label = document.querySelector(`label[for="${escapedId}"]`);
    if (label) {
        return true;
    }
    // The label may not be directly associated with the element but may be a sibling
    const siblings = Array.from(element.parentElement?.children || []);
    for (let sibling of siblings) {
        if (sibling.tagName.toLowerCase() === "label") {
            return true;
        }
    }
    return false;
}
const isTaggableTextNode = (child) => {
    return isNonWhiteSpaceTextNode(child) && isTextNodeAValidWord(child);
};
const isNonWhiteSpaceTextNode = (child) => {
    return (child.nodeType === Node.TEXT_NODE &&
        child.textContent &&
        child.textContent.trim().length > 0 &&
        child.textContent.trim() !== "\u200B");
};
const isTextNodeAValidWord = (child) => {
    // We don't want to be tagging separator symbols like '|' or '/' or '>' etc
    const trimmedWord = child.textContent?.trim();
    return trimmedWord && (trimmedWord.match(/\w/) || trimmedWord.length > 3); // Regex matches any character, number, or _
};
const inputs = ["a", "button", "textarea", "select", "details", "label"];
const isInteractable = (el) => {
    // If it is a label but has an input child that it is a label for, say not interactable
    if (el.tagName.toLowerCase() === "label" && el.querySelector("input")) {
        return false;
    }
    return (inputs.includes(el.tagName.toLowerCase()) ||
        // @ts-ignore
        (el.tagName.toLowerCase() === "input" && el.type !== "hidden") ||
        el.role === "button");
};
const text_input_types = [
    "text",
    "password",
    "email",
    "search",
    "url",
    "tel",
    "number",
];
const isTextInsertable = (el) => el.tagName.toLowerCase() === "textarea" ||
    (el.tagName.toLowerCase() === "input" &&
        text_input_types.includes(el.type));
// These tags may not have text but can still be interactable
const textLessTagWhiteList = ["input", "textarea", "select", "button", "a"];
const isTextLess = (el) => {
    const tagName = el.tagName.toLowerCase();
    if (textLessTagWhiteList.includes(tagName))
        return false;
    if (el.childElementCount > 0)
        return false;
    if ("innerText" in el && el.innerText.trim().length === 0) {
        // look for svg or img in the element
        const svg = el.querySelector("svg");
        const img = el.querySelector("img");
        if (svg || img)
            return false;
        return isElementInViewport(el);
    }
    return false;
};
function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    const isLargerThan1x1 = rect.width > 1 || rect.height > 1;
    let body = document.body, html = document.documentElement;
    const height = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
    const width = Math.max(body.scrollWidth, body.offsetWidth, html.clientWidth, html.scrollWidth, html.offsetWidth);
    return (isLargerThan1x1 &&
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= height &&
        rect.right <= width);
}
function getElementXPath(element) {
    let path_parts = [];
    let iframe_str = "";
    if (element && element.ownerDocument !== window.document) {
        // assert element.iframe_index !== undefined, "Element is not in the main document and does not have an iframe_index attribute";
        iframe_str = `iframe[${element.getAttribute("iframe_index")}]`;
    }
    while (element) {
        if (!element.tagName) {
            element = element.parentNode;
            continue;
        }
        let tagName = element.tagName.toLowerCase();
        let prefix = window.fixNamespaces(tagName);
        let sibling_index = 1;
        let sibling = element.previousElementSibling;
        while (sibling) {
            if (sibling.tagName === element.tagName && sibling.id != tarsierId) {
                sibling_index++;
            }
            sibling = sibling.previousElementSibling;
        }
        // Check next siblings to determine if index should be added
        let nextSibling = element.nextElementSibling;
        let shouldAddIndex = false;
        while (nextSibling) {
            if (nextSibling.tagName === element.tagName) {
                shouldAddIndex = true;
                break;
            }
            nextSibling = nextSibling.nextElementSibling;
        }
        if (sibling_index > 1 || shouldAddIndex) {
            prefix += `[${sibling_index}]`;
        }
        if (element.id) {
            prefix += `[@id="${element.id}"]`;
            // If the id is unique and we have enough path parts, we can stop
            if (path_parts.length > 3) {
                path_parts.unshift(prefix);
                return "//" + path_parts.join("/");
            }
        }
        else if (element.className) {
            prefix += `[@class="${element.className}"]`;
        }
        path_parts.unshift(prefix);
        element = element.parentNode;
    }
    return iframe_str + "//" + path_parts.join("/");
}
function create_tagged_span(idNum, el) {
    let idStr;
    if (isInteractable(el)) {
        if (isTextInsertable(el))
            idStr = `[#${idNum}]`;
        else if (el.tagName.toLowerCase() == "a")
            idStr = `[@${idNum}]`;
        else
            idStr = `[$${idNum}]`;
    }
    else {
        idStr = `[${idNum}]`;
    }
    let idSpan = document.createElement("span");
    idSpan.id = tarsierId;
    idSpan.style.position = "relative";
    idSpan.style.display = "inline";
    idSpan.style.color = "white";
    idSpan.style.backgroundColor = "red";
    idSpan.style.padding = "1.5px";
    idSpan.style.borderRadius = "3px";
    idSpan.style.fontWeight = "bold";
    // idSpan.style.fontSize = "15px"; // Removing because OCR won't see small text among large font
    idSpan.style.fontFamily = "Arial";
    idSpan.style.margin = "1px";
    idSpan.style.lineHeight = "1.25";
    idSpan.style.letterSpacing = "2px";
    idSpan.style.zIndex = "2140000046";
    idSpan.style.clip = "auto";
    idSpan.style.height = "fit-content";
    idSpan.style.width = "fit-content";
    idSpan.style.minHeight = "15px";
    idSpan.style.minWidth = "23px";
    idSpan.style.maxHeight = "unset";
    idSpan.style.maxWidth = "unset";
    idSpan.textContent = idStr;
    idSpan.style.webkitTextFillColor = "white";
    idSpan.style.textShadow = "";
    idSpan.style.textDecoration = "none";
    idSpan.style.letterSpacing = "0px";
    idSpan.setAttribute(tarsierDataAttribute, idNum.toString());
    return idSpan;
}
const MIN_FONT_SIZE = 11;
const ensureMinimumTagFontSizes = () => {
    const tags = Array.from(document.querySelectorAll(tarsierSelector));
    tags.forEach((tag) => {
        let fontSize = parseFloat(window.getComputedStyle(tag).fontSize.split("px")[0]);
        if (fontSize < MIN_FONT_SIZE) {
            tag.style.fontSize = `${MIN_FONT_SIZE}px`;
        }
    });
};
window.tagifyWebpage = (tagLeafTexts = true) => {
    window.removeTags();
    hideMapElements();
    const allElements = getAllElementsInAllFrames();
    const rawElementsToTag = getElementsToTag(allElements, tagLeafTexts);
    const elementsToTag = removeNestedTags(rawElementsToTag);
    const idToTagMeta = insertTags(elementsToTag, tagLeafTexts);
    shrinkCollidingTags();
    ensureMinimumTagFontSizes();
    var res = Object.entries(idToTagMeta).reduce((acc, [id, meta]) => {
        acc[parseInt(id)] = meta;
        return acc;
    }, {});
    // res => array of objects
    var array = Object.values(res);
    return { data: array };
};
function getAllElementsInAllFrames() {
    // Main page
    const allElements = Array.from(document.body.querySelectorAll("*"));
    // Add all elements in iframes
    // NOTE: This still doesn't work for all iframes
    const iframes = document.getElementsByTagName("iframe");
    for (let i = 0; i < iframes.length; i++) {
        try {
            const frame = iframes[i];
            const iframeDocument = frame.contentDocument || frame.contentWindow?.document;
            if (!iframeDocument)
                continue;
            const iframeElements = Array.from(iframeDocument.querySelectorAll("*"));
            iframeElements.forEach((el) => el.setAttribute("iframe_index", i.toString()));
            allElements.push(...iframeElements);
        }
        catch (e) {
            console.error("Error accessing iframe content:", e);
        }
    }
    return allElements;
}
function getElementsToTag(allElements, tagLeafTexts) {
    const elementsToTag = [];
    for (let el of allElements) {
        if (isTextLess(el) || !elIsVisible(el)) {
            continue;
        }
        if (isInteractable(el)) {
            elementsToTag.push(el);
        }
        else if (tagLeafTexts) {
            // Append the parent tag as it may have multiple individual child nodes with text
            // We will tag them individually later
            if (Array.from(el.childNodes).filter(isTaggableTextNode).length >= 1) {
                elementsToTag.push(el);
            }
        }
    }
    return elementsToTag;
}
function removeNestedTags(elementsToTag) {
    // An interactable element may have multiple tagged elements inside
    // Most commonly, the text will be tagged alongside the interactable element
    // In this case there is only one child, and we should remove this nested tag
    // In other cases, we will allow for the nested tagging
    const res = [...elementsToTag];
    elementsToTag.map((el) => {
        // Only interactable elements can have nested tags
        if (isInteractable(el)) {
            const elementsToRemove = [];
            el.querySelectorAll("*").forEach((child) => {
                const index = res.indexOf(child);
                if (index > -1) {
                    elementsToRemove.push(child);
                }
            });
            // Only remove nested tags if there is only a single element to remove
            if (elementsToRemove.length <= 2) {
                for (let element of elementsToRemove) {
                    res.splice(res.indexOf(element), 1);
                }
            }
        }
    });
    return res;
}
function insertTags(elementsToTag, tagLeafTexts) {
    function trimTextNodeStart(element) {
        // Trim leading whitespace from the element's text content
        // This way, the tag will be inline with the word and not textwrap
        // Element text
        if (!element.firstChild || element.firstChild.nodeType !== Node.TEXT_NODE) {
            return;
        }
        const textNode = element.firstChild;
        textNode.textContent = textNode.textContent.trimStart();
    }
    function getElementToInsertInto(element, idSpan) {
        // An <a> tag may just be a wrapper over many elements. (Think an <a> with a <span> and another <span>
        // If these sub children are the only children, they might have styling that mis-positions the tag we're attempting to
        // insert. Because of this, we should drill down among these single children to insert this tag
        // Some elements might just be empty. They should not count as "children" and if there are candidates to drill down
        // into when these empty elements are considered, we should drill
        const childrenToConsider = Array.from(element.childNodes).filter((child) => {
            if (isNonWhiteSpaceTextNode(child)) {
                return true;
            }
            else if (child.nodeType === Node.TEXT_NODE) {
                return false;
            }
            return !(child.nodeType === Node.ELEMENT_NODE &&
                (isTextLess(child) ||
                    !elIsVisible(child)));
        });
        if (childrenToConsider.length === 1) {
            const child = childrenToConsider[0];
            // Also check its a span or P tag
            const elementsToDrillDown = [
                "div",
                "span",
                "p",
                "h1",
                "h2",
                "h3",
                "h4",
                "h5",
                "h6",
            ];
            if (child.nodeType === Node.ELEMENT_NODE &&
                elementsToDrillDown.includes(child.tagName.toLowerCase())) {
                return getElementToInsertInto(child, idSpan);
            }
        }
        trimTextNodeStart(element);
        // Base case
        return element;
    }
    const idToTagMetadata = {};
    let idNum = 0;
    for (let el of elementsToTag) {
        idToTagMetadata[idNum] = {
            xpath: getElementXPath(el),
            ariaLabel: el.getAttribute("aria-label") || undefined,
            label: idNum.toString(),
        };
        if (isInteractable(el)) {
            const idSpan = create_tagged_span(idNum, el);
            if (isTextInsertable(el) && el.parentElement) {
                el.parentElement.insertBefore(idSpan, el);
            }
            else {
                const insertionElement = getElementToInsertInto(el, idSpan);
                insertionElement.prepend(idSpan);
                absolutelyPositionTagIfMisaligned(idSpan, insertionElement);
            }
            idNum++;
        }
        else if (tagLeafTexts) {
            trimTextNodeStart(el);
            const validTextNodes = Array.from(el.childNodes).filter(isTaggableTextNode);
            const allTextNodes = Array.from(el.childNodes).filter((child) => child.nodeType === Node.TEXT_NODE);
            for (let child of validTextNodes) {
                const parentXPath = getElementXPath(el);
                const textNodeIndex = allTextNodes.indexOf(child) + 1;
                idToTagMetadata[idNum] = {
                    xpath: parentXPath,
                    textNodeIndex: textNodeIndex,
                    label: idNum.toString(),
                    ariaLabel: el.getAttribute("aria-label") || undefined,
                };
                const idSpan = create_tagged_span(idNum, el);
                el.insertBefore(idSpan, child);
                idNum++;
            }
        }
    }
    return idToTagMetadata;
}
function absolutelyPositionTagIfMisaligned(tag, reference) {
    /*
    Some tags don't get displayed on the page properly
    This occurs if the parent element children are disjointed from the parent
    In this case, we absolutely position the tag to the parent element
    */
    let tagRect = tag.getBoundingClientRect();
    if (!(tagRect.width === 0 || tagRect.height === 0)) {
        return;
    }
    const distanceThreshold = 250;
    // Check if the expected position is off-screen horizontally
    const expectedTagPositionRect = reference.getBoundingClientRect();
    if (expectedTagPositionRect.right < 0 ||
        expectedTagPositionRect.left >
        (window.innerWidth || document.documentElement.clientWidth)) {
        // Expected position is off-screen horizontally, remove the tag
        tag.remove();
        return; // Skip to the next tag
    }
    const referenceTopLeft = {
        x: expectedTagPositionRect.left,
        y: expectedTagPositionRect.top,
    };
    const tagCenter = {
        x: (tagRect.left + tagRect.right) / 2,
        y: (tagRect.top + tagRect.bottom) / 2,
    };
    const dx = Math.abs(referenceTopLeft.x - tagCenter.x);
    const dy = Math.abs(referenceTopLeft.y - tagCenter.y);
    if (dx > distanceThreshold || dy > distanceThreshold || !elIsVisible(tag)) {
        tag.style.position = "absolute";
        // Ensure the tag is positioned within the screen bounds
        let leftPosition = Math.max(0, expectedTagPositionRect.left - (tagRect.right + 3 - tagRect.left));
        leftPosition = Math.min(leftPosition, window.innerWidth - (tagRect.right - tagRect.left));
        let topPosition = Math.max(0, expectedTagPositionRect.top + 3); // Add some top buffer to center align better
        topPosition = Math.min(topPosition, Math.max(window.innerHeight, document.documentElement.scrollHeight) -
            (tagRect.bottom - tagRect.top));
        tag.style.left = `${leftPosition}px`;
        tag.style.top = `${topPosition}px`;
        tag.parentElement && tag.parentElement.removeChild(tag);
        document.body.appendChild(tag);
    }
}
const shrinkCollidingTags = () => {
    const tags = Array.from(document.querySelectorAll(tarsierSelector));
    for (let i = 0; i < tags.length; i++) {
        const tag = tags[i];
        let tagRect = tag.getBoundingClientRect();
        let fontSize = parseFloat(window.getComputedStyle(tag).fontSize.split("px")[0]);
        for (let j = i + 1; j < tags.length; j++) {
            const otherTag = tags[j];
            let otherTagRect = otherTag.getBoundingClientRect();
            let otherFontSize = parseFloat(window.getComputedStyle(otherTag).fontSize.split("px")[0]);
            while (tagRect.left < otherTagRect.right &&
                tagRect.right > otherTagRect.left &&
                tagRect.top < otherTagRect.bottom &&
                tagRect.bottom > otherTagRect.top &&
                fontSize > MIN_FONT_SIZE &&
                otherFontSize > MIN_FONT_SIZE) {
                fontSize -= 0.5;
                otherFontSize -= 0.5;
                tag.style.fontSize = `${fontSize}px`;
                otherTag.style.fontSize = `${otherFontSize}px`;
                tagRect = tag.getBoundingClientRect();
                otherTagRect = otherTag.getBoundingClientRect();
            }
        }
    }
};
window.removeTags = () => {
    const tags = document.querySelectorAll(tarsierSelector);
    tags.forEach((tag) => tag.remove());
    showMapElements();
};
const GOOGLE_MAPS_OPACITY_CONTROL = "__reworkd_google_maps_opacity";
const hideMapElements = () => {
    // Maps have lots of tiny buttons that need to be tagged
    // They also have a lot of tiny text and are annoying to deal with for rendering
    // Also any element with aria-label="Map" aria-roledescription="map"
    const selectors = [
        'iframe[src*="google.com/maps"]',
        'iframe[id*="gmap_canvas"]',
        ".maplibregl-map",
        ".mapboxgl-map",
        ".leaflet-container",
        'img[src*="maps.googleapis.com"]',
        '[aria-label="Map"]',
        ".cmp-location-map__map",
        '.map-view[data-role="mapView"]',
        ".google_Map-wrapper",
        ".google_map-wrapper",
        ".googleMap-wrapper",
        ".googlemap-wrapper",
        ".ls-map-canvas",
        ".gmapcluster",
        "#googleMap",
        "#googleMaps",
        "#googlemaps",
        "#googlemap",
        "#google_map",
        "#google_maps",
        "#MapId",
        ".geolocation-map-wrapper",
        ".locatorMap",
    ];
    document.querySelectorAll(selectors.join(", ")).forEach((element) => {
        const currentOpacity = window.getComputedStyle(element).opacity;
        // Store current opacity
        element.setAttribute("data-original-opacity", currentOpacity);
        element.style.opacity = "0";
    });
};
const showMapElements = () => {
    const elements = document.querySelectorAll(`[${GOOGLE_MAPS_OPACITY_CONTROL}]`);
    elements.forEach((element) => {
        element.style.opacity =
            element.getAttribute("data-original-opacity") || "1";
    });
};
window.hideNonTagElements = () => {
    const allElements = getAllElementsInAllFrames();
    allElements.forEach((el) => {
        const element = el;
        if (element.style.visibility) {
            element.setAttribute(reworkdVisibilityAttribute, element.style.visibility);
        }
        if (!element.id.startsWith(tarsierId)) {
            element.style.visibility = "hidden";
        }
        else {
            element.style.visibility = "visible";
        }
    });
};
window.fixNamespaces = (tagName) => {
    // Namespaces in XML give elements unique prefixes (e.g., "a:tag").
    // Standard XPath with namespaces can fail to find elements.
    // The `name()` function returns the full element name, including the prefix.
    // Using "/*[name()='a:tag']" ensures the XPath matches the element correctly.
    const validNamespaceTag = /^[a-zA-Z_][\w\-.]*:[a-zA-Z_][\w\-.]*$/;
    // Split the tagName by '#' (ID) and '.' (class) to isolate the tag name part
    const tagOnly = tagName.split(/[#.]/)[0];
    if (validNamespaceTag.test(tagOnly)) {
        // If it's a valid namespaced tag, wrap with the name() function
        return tagName.replace(tagOnly, `*[name()="${tagOnly}"]`);
    }
    else {
        return tagName;
    }
};
window.revertVisibilities = () => {
    const allElements = getAllElementsInAllFrames();
    allElements.forEach((el) => {
        const element = el;
        if (element.getAttribute(reworkdVisibilityAttribute)) {
            element.style.visibility =
                element.getAttribute(reworkdVisibilityAttribute) || "true";
        }
        else {
            element.style.removeProperty("visibility");
        }
    });
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFnX3V0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGFnX3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFvQkEsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDO0FBQ2pDLE1BQU0sb0JBQW9CLEdBQUcsaUJBQWlCLENBQUM7QUFDL0MsTUFBTSxlQUFlLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztBQUN4QyxNQUFNLDBCQUEwQixHQUFHLDZCQUE2QixDQUFDO0FBRWpFLE1BQU0sV0FBVyxHQUFHLENBQUMsRUFBZSxFQUFFLEVBQUU7SUFDdEMsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLHFCQUFxQixFQUFFLENBQUM7SUFDeEMsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRWxELE1BQU0sUUFBUSxHQUNaLGFBQWEsQ0FBQyxVQUFVLEtBQUssUUFBUTtRQUNyQyxhQUFhLENBQUMsT0FBTyxLQUFLLE1BQU07UUFDaEMsRUFBRSxDQUFDLE1BQU07UUFDVCxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBRS9ELE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQyxPQUFPLEtBQUssR0FBRyxDQUFDO0lBQ2xELHNGQUFzRjtJQUN0RixNQUFNLGFBQWEsR0FBRyxXQUFXLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbkQsTUFBTSxpQkFBaUIsR0FBRyxhQUFhLENBQUMsT0FBTyxLQUFLLFVBQVUsQ0FBQztJQUMvRCxNQUFNLFVBQVUsR0FDZCxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLHFEQUFxRDtJQUN0SCxNQUFNLGVBQWUsR0FBRyxFQUFFLENB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QU8sQ0FBQyxZQUFZLENBQUMsMEJBQTBCLENBQUMsRUFBRTtZQUNwRCxPQUFPLENBQUMsS0FBSyxDQUFDLFVBQVU7Z0JBQ3RCLE9BQU8sQ0FBQyxZQUFZLENBQUMsMEJBQTBCLENBQUMsSUFBSSxNQUFNLENBQUM7U0FDOUQ7YUFBTTtZQUNMLE9BQU8sQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLFlBQVksQ0FBQyxDQUFDO1NBQzVDO0lBQ0gsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvLyBub2luc3BlY3Rpb24gSlNVbnVzZWRHbG9iYWxTeW1ib2xzXHJcbmludGVyZmFjZSBXaW5kb3cge1xyXG4gIC8vIFBsYXl3cmlnaHQncyAuZXZhbHVhdGUgbWV0aG9kIHJ1bnMgamF2YXNjcmlwdCBjb2RlIGluIGFuIGlzb2xhdGVkIHNjb3BlLlxyXG4gIC8vIFRoaXMgbWVhbnMgdGhhdCBzdWJzZXF1ZW50IGNhbGxzIHRvIC5ldmFsdWF0ZSB3aWxsIG5vdCBoYXZlIGFjY2VzcyB0byB0aGUgZnVuY3Rpb25zIGRlZmluZWQgaW4gdGhpcyBmaWxlXHJcbiAgLy8gc2luY2UgdGhleSB3aWxsIGJlIGluIGFuIGluYWNjZXNzaWJsZSBzY29wZS4gVG8gY2lyY3VtdmVudCB0aGlzLCB3ZSBhdHRhY2ggdGhlIGZvbGxvd2luZyBtZXRob2RzIHRvIHRoZVxyXG4gIC8vIHdpbmRvdyB3aGljaCBpcyBhbHdheXMgYXZhaWxhYmxlIGdsb2JhbGx5IHdoZW4gcnVuIGluIGEgYnJvd3NlciBlbnZpcm9ubWVudC5cclxuICB0YWdpZnlXZWJwYWdlOiAodGFnTGVhZlRleHRzPzogYm9vbGVhbikgPT4geyBkYXRhOiB7IFtrZXk6IG51bWJlcl06IFRhZ01ldGFkYXRhIH0gfTtcclxuICByZW1vdmVUYWdzOiAoKSA9PiB2b2lkO1xyXG4gIGhpZGVOb25UYWdFbGVtZW50czogKCkgPT4gdm9pZDtcclxuICByZXZlcnRWaXNpYmlsaXRpZXM6ICgpID0+IHZvaWQ7XHJcbiAgZml4TmFtZXNwYWNlczogKHRhZ05hbWU6IHN0cmluZykgPT4gc3RyaW5nO1xyXG59XHJcblxyXG5pbnRlcmZhY2UgVGFnTWV0YWRhdGEge1xyXG4gIGFyaWFMYWJlbD86IHN0cmluZztcclxuICB4cGF0aDogc3RyaW5nO1xyXG4gIHRleHROb2RlSW5kZXg/OiBudW1iZXI7IC8vIFVzZWQgaWYgdGhlIHRhZyByZWZlcnMgdG8gc3BlY2lmaWMgVGV4dE5vZGUgZWxlbWVudHMgd2l0aGluIHRoZSB0YWdnZWQgRWxlbWVudE5vZGVcclxuICBsYWJlbDogc3RyaW5nO1xyXG59XHJcblxyXG5jb25zdCB0YXJzaWVySWQgPSBcIl9fdGFyc2llcl9pZFwiO1xyXG5jb25zdCB0YXJzaWVyRGF0YUF0dHJpYnV0ZSA9IFwiZGF0YS10YXJzaWVyLWlkXCI7XHJcbmNvbnN0IHRhcnNpZXJTZWxlY3RvciA9IGAjJHt0YXJzaWVySWR9YDtcclxuY29uc3QgcmV3b3JrZFZpc2liaWxpdHlBdHRyaWJ1dGUgPSBcInJld29ya2Qtb3JpZ2luYWwtdmlzaWJpbGl0eVwiO1xyXG5cclxuY29uc3QgZWxJc1Zpc2libGUgPSAoZWw6IEhUTUxFbGVtZW50KSA9PiB7XHJcbiAgY29uc3QgcmVjdCA9IGVsLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gIGNvbnN0IGNvbXB1dGVkU3R5bGUgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbCk7XHJcblxyXG4gIGNvbnN0IGlzSGlkZGVuID1cclxuICAgIGNvbXB1dGVkU3R5bGUudmlzaWJpbGl0eSA9PT0gXCJoaWRkZW5cIiB8fFxyXG4gICAgY29tcHV0ZWRTdHlsZS5kaXNwbGF5ID09PSBcIm5vbmVcIiB8fFxyXG4gICAgZWwuaGlkZGVuIHx8XHJcbiAgICAoZWwuaGFzQXR0cmlidXRlKFwiZGlzYWJsZWRcIikgJiYgZWwuZ2V0QXR0cmlidXRlKFwiZGlzYWJsZWRcIikpO1xyXG5cclxuICBjb25zdCBoYXMwT3BhY2l0eSA9IGNvbXB1dGVkU3R5bGUub3BhY2l0eSA9PT0gXCIwXCI7XHJcbiAgLy8gT2Z0ZW4gaW5wdXQgZWxlbWVudHMgd2lsbCBoYXZlIDAgb3BhY2l0eSBidXQgc3RpbGwgaGF2ZSBzb21lIGludGVyYWN0YWJsZSBjb21wb25lbnRcclxuICBjb25zdCBpc1RyYW5zcGFyZW50ID0gaGFzME9wYWNpdHkgJiYgIWhhc0xhYmVsKGVsKTtcclxuICBjb25zdCBpc0Rpc3BsYXlDb250ZW50cyA9IGNvbXB1dGVkU3R5bGUuZGlzcGxheSA9PT0gXCJjb250ZW50c1wiO1xyXG4gIGNvbnN0IGlzWmVyb1NpemUgPVxyXG4gICAgKHJlY3Qud2lkdGggPT09IDAgfHwgcmVjdC5oZWlnaHQgPT09IDApICYmICFpc0Rpc3BsYXlDb250ZW50czsgLy8gZGlzcGxheTogY29udGVudHMgZWxlbWVudHMgaGF2ZSAwIHdpZHRoIGFuZCBoZWlnaHRcclxuICBjb25zdCBpc1NjcmlwdE9yU3R5bGUgPSBlbC50YWdOYW1lID09PSBcIlNDUklQVFwiIHx8IGVsLnRhZ05hbWUgPT09IFwiU1RZTEVcIjtcclxuICByZXR1cm4gIWlzSGlkZGVuICYmICFpc1RyYW5zcGFyZW50ICYmICFpc1plcm9TaXplICYmICFpc1NjcmlwdE9yU3R5bGU7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBoYXNMYWJlbChlbGVtZW50OiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xyXG4gIGNvbnN0IHRhZ3NUaGF0Q2FuSGF2ZUxhYmVscyA9IFtcImlucHV0XCIsIFwidGV4dGFyZWFcIiwgXCJzZWxlY3RcIiwgXCJidXR0b25cIl07XHJcblxyXG4gIGlmICghdGFnc1RoYXRDYW5IYXZlTGFiZWxzLmluY2x1ZGVzKGVsZW1lbnQudGFnTmFtZS50b0xvd2VyQ2FzZSgpKSkge1xyXG4gICAgcmV0dXJuIGZhbHNlO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgZXNjYXBlZElkID0gQ1NTLmVzY2FwZShlbGVtZW50LmlkKTtcclxuICBjb25zdCBsYWJlbCA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoYGxhYmVsW2Zvcj1cIiR7ZXNjYXBlZElkfVwiXWApO1xyXG5cclxuICBpZiAobGFiZWwpIHtcclxuICAgIHJldHVybiB0cnVlO1xyXG4gIH1cclxuXHJcbiAgLy8gVGhlIGxhYmVsIG1heSBub3QgYmUgZGlyZWN0bHkgYXNzb2NpYXRlZCB3aXRoIHRoZSBlbGVtZW50IGJ1dCBtYXkgYmUgYSBzaWJsaW5nXHJcbiAgY29uc3Qgc2libGluZ3MgPSBBcnJheS5mcm9tKGVsZW1lbnQucGFyZW50RWxlbWVudD8uY2hpbGRyZW4gfHwgW10pO1xyXG4gIGZvciAobGV0IHNpYmxpbmcgb2Ygc2libGluZ3MpIHtcclxuICAgIGlmIChzaWJsaW5nLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJsYWJlbFwiKSB7XHJcbiAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGZhbHNlO1xyXG59XHJcblxyXG5jb25zdCBpc1RhZ2dhYmxlVGV4dE5vZGUgPSAoY2hpbGQ6IENoaWxkTm9kZSkgPT4ge1xyXG4gIHJldHVybiBpc05vbldoaXRlU3BhY2VUZXh0Tm9kZShjaGlsZCkgJiYgaXNUZXh0Tm9kZUFWYWxpZFdvcmQoY2hpbGQpO1xyXG59O1xyXG5cclxuY29uc3QgaXNOb25XaGl0ZVNwYWNlVGV4dE5vZGUgPSAoY2hpbGQ6IENoaWxkTm9kZSkgPT4ge1xyXG4gIHJldHVybiAoXHJcbiAgICBjaGlsZC5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUgJiZcclxuICAgIGNoaWxkLnRleHRDb250ZW50ICYmXHJcbiAgICBjaGlsZC50ZXh0Q29udGVudC50cmltKCkubGVuZ3RoID4gMCAmJlxyXG4gICAgY2hpbGQudGV4dENvbnRlbnQudHJpbSgpICE9PSBcIlxcdTIwMEJcIlxyXG4gICk7XHJcbn07XHJcblxyXG5jb25zdCBpc1RleHROb2RlQVZhbGlkV29yZCA9IChjaGlsZDogQ2hpbGROb2RlKSA9PiB7XHJcbiAgLy8gV2UgZG9uJ3Qgd2FudCB0byBiZSB0YWdnaW5nIHNlcGFyYXRvciBzeW1ib2xzIGxpa2UgJ3wnIG9yICcvJyBvciAnPicgZXRjXHJcbiAgY29uc3QgdHJpbW1lZFdvcmQgPSBjaGlsZC50ZXh0Q29udGVudD8udHJpbSgpO1xyXG4gIHJldHVybiB0cmltbWVkV29yZCAmJiAodHJpbW1lZFdvcmQubWF0Y2goL1xcdy8pIHx8IHRyaW1tZWRXb3JkLmxlbmd0aCA+IDMpOyAvLyBSZWdleCBtYXRjaGVzIGFueSBjaGFyYWN0ZXIsIG51bWJlciwgb3IgX1xyXG59O1xyXG5cclxuY29uc3QgaW5wdXRzID0gW1wiYVwiLCBcImJ1dHRvblwiLCBcInRleHRhcmVhXCIsIFwic2VsZWN0XCIsIFwiZGV0YWlsc1wiLCBcImxhYmVsXCJdO1xyXG5jb25zdCBpc0ludGVyYWN0YWJsZSA9IChlbDogSFRNTEVsZW1lbnQpID0+IHtcclxuICAvLyBJZiBpdCBpcyBhIGxhYmVsIGJ1dCBoYXMgYW4gaW5wdXQgY2hpbGQgdGhhdCBpdCBpcyBhIGxhYmVsIGZvciwgc2F5IG5vdCBpbnRlcmFjdGFibGVcclxuICBpZiAoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImxhYmVsXCIgJiYgZWwucXVlcnlTZWxlY3RvcihcImlucHV0XCIpKSB7XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gKFxyXG4gICAgaW5wdXRzLmluY2x1ZGVzKGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSkgfHxcclxuICAgIC8vIEB0cy1pZ25vcmVcclxuICAgIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwiaW5wdXRcIiAmJiBlbC50eXBlICE9PSBcImhpZGRlblwiKSB8fFxyXG4gICAgZWwucm9sZSA9PT0gXCJidXR0b25cIlxyXG4gICk7XHJcbn07XHJcblxyXG5jb25zdCB0ZXh0X2lucHV0X3R5cGVzID0gW1xyXG4gIFwidGV4dFwiLFxyXG4gIFwicGFzc3dvcmRcIixcclxuICBcImVtYWlsXCIsXHJcbiAgXCJzZWFyY2hcIixcclxuICBcInVybFwiLFxyXG4gIFwidGVsXCIsXHJcbiAgXCJudW1iZXJcIixcclxuXTtcclxuY29uc3QgaXNUZXh0SW5zZXJ0YWJsZSA9IChlbDogSFRNTEVsZW1lbnQpID0+XHJcbiAgZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcInRleHRhcmVhXCIgfHxcclxuICAoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImlucHV0XCIgJiZcclxuICAgIHRleHRfaW5wdXRfdHlwZXMuaW5jbHVkZXMoKGVsIGFzIEhUTUxJbnB1dEVsZW1lbnQpLnR5cGUpKTtcclxuXHJcbi8vIFRoZXNlIHRhZ3MgbWF5IG5vdCBoYXZlIHRleHQgYnV0IGNhbiBzdGlsbCBiZSBpbnRlcmFjdGFibGVcclxuY29uc3QgdGV4dExlc3NUYWdXaGl0ZUxpc3QgPSBbXCJpbnB1dFwiLCBcInRleHRhcmVhXCIsIFwic2VsZWN0XCIsIFwiYnV0dG9uXCIsIFwiYVwiXTtcclxuXHJcbmNvbnN0IGlzVGV4dExlc3MgPSAoZWw6IEhUTUxFbGVtZW50KSA9PiB7XHJcbiAgY29uc3QgdGFnTmFtZSA9IGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcclxuICBpZiAodGV4dExlc3NUYWdXaGl0ZUxpc3QuaW5jbHVkZXModGFnTmFtZSkpIHJldHVybiBmYWxzZTtcclxuICBpZiAoZWwuY2hpbGRFbGVtZW50Q291bnQgPiAwKSByZXR1cm4gZmFsc2U7XHJcbiAgaWYgKFwiaW5uZXJUZXh0XCIgaW4gZWwgJiYgZWwuaW5uZXJUZXh0LnRyaW0oKS5sZW5ndGggPT09IDApIHtcclxuICAgIC8vIGxvb2sgZm9yIHN2ZyBvciBpbWcgaW4gdGhlIGVsZW1lbnRcclxuICAgIGNvbnN0IHN2ZyA9IGVsLnF1ZXJ5U2VsZWN0b3IoXCJzdmdcIik7XHJcbiAgICBjb25zdCBpbWcgPSBlbC5xdWVyeVNlbGVjdG9yKFwiaW1nXCIpO1xyXG5cclxuICAgIGlmIChzdmcgfHwgaW1nKSByZXR1cm4gZmFsc2U7XHJcblxyXG4gICAgcmV0dXJuIGlzRWxlbWVudEluVmlld3BvcnQoZWwpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGZhbHNlO1xyXG59O1xyXG5cclxuZnVuY3Rpb24gaXNFbGVtZW50SW5WaWV3cG9ydChlbDogSFRNTEVsZW1lbnQpIHtcclxuICBjb25zdCByZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcblxyXG4gIGNvbnN0IGlzTGFyZ2VyVGhhbjF4MSA9IHJlY3Qud2lkdGggPiAxIHx8IHJlY3QuaGVpZ2h0ID4gMTtcclxuXHJcbiAgbGV0IGJvZHkgPSBkb2N1bWVudC5ib2R5LFxyXG4gICAgaHRtbCA9IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudDtcclxuICBjb25zdCBoZWlnaHQgPSBNYXRoLm1heChcclxuICAgIGJvZHkuc2Nyb2xsSGVpZ2h0LFxyXG4gICAgYm9keS5vZmZzZXRIZWlnaHQsXHJcbiAgICBodG1sLmNsaWVudEhlaWdodCxcclxuICAgIGh0bWwuc2Nyb2xsSGVpZ2h0LFxyXG4gICAgaHRtbC5vZmZzZXRIZWlnaHQsXHJcbiAgKTtcclxuICBjb25zdCB3aWR0aCA9IE1hdGgubWF4KFxyXG4gICAgYm9keS5zY3JvbGxXaWR0aCxcclxuICAgIGJvZHkub2Zmc2V0V2lkdGgsXHJcbiAgICBodG1sLmNsaWVudFdpZHRoLFxyXG4gICAgaHRtbC5zY3JvbGxXaWR0aCxcclxuICAgIGh0bWwub2Zmc2V0V2lkdGgsXHJcbiAgKTtcclxuXHJcbiAgcmV0dXJuIChcclxuICAgIGlzTGFyZ2VyVGhhbjF4MSAmJlxyXG4gICAgcmVjdC50b3AgPj0gMCAmJlxyXG4gICAgcmVjdC5sZWZ0ID49IDAgJiZcclxuICAgIHJlY3QuYm90dG9tIDw9IGhlaWdodCAmJlxyXG4gICAgcmVjdC5yaWdodCA8PSB3aWR0aFxyXG4gICk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEVsZW1lbnRYUGF0aChlbGVtZW50OiBIVE1MRWxlbWVudCB8IG51bGwpIHtcclxuICBsZXQgcGF0aF9wYXJ0cyA9IFtdO1xyXG5cclxuICBsZXQgaWZyYW1lX3N0ciA9IFwiXCI7XHJcbiAgaWYgKGVsZW1lbnQgJiYgZWxlbWVudC5vd25lckRvY3VtZW50ICE9PSB3aW5kb3cuZG9jdW1lbnQpIHtcclxuICAgIC8vIGFzc2VydCBlbGVtZW50LmlmcmFtZV9pbmRleCAhPT0gdW5kZWZpbmVkLCBcIkVsZW1lbnQgaXMgbm90IGluIHRoZSBtYWluIGRvY3VtZW50IGFuZCBkb2VzIG5vdCBoYXZlIGFuIGlmcmFtZV9pbmRleCBhdHRyaWJ1dGVcIjtcclxuICAgIGlmcmFtZV9zdHIgPSBgaWZyYW1lWyR7ZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJpZnJhbWVfaW5kZXhcIil9XWA7XHJcbiAgfVxyXG5cclxuICB3aGlsZSAoZWxlbWVudCkge1xyXG4gICAgaWYgKCFlbGVtZW50LnRhZ05hbWUpIHtcclxuICAgICAgZWxlbWVudCA9IGVsZW1lbnQucGFyZW50Tm9kZSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgICAgIGNvbnRpbnVlO1xyXG4gICAgfVxyXG5cclxuICAgIGxldCB0YWdOYW1lID0gZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCk7XHJcblxyXG4gICAgbGV0IHByZWZpeCA9IHdpbmRvdy5maXhOYW1lc3BhY2VzKHRhZ05hbWUpO1xyXG5cclxuICAgIGxldCBzaWJsaW5nX2luZGV4ID0gMTtcclxuXHJcbiAgICBsZXQgc2libGluZyA9IGVsZW1lbnQucHJldmlvdXNFbGVtZW50U2libGluZztcclxuICAgIHdoaWxlIChzaWJsaW5nKSB7XHJcbiAgICAgIGlmIChzaWJsaW5nLnRhZ05hbWUgPT09IGVsZW1lbnQudGFnTmFtZSAmJiBzaWJsaW5nLmlkICE9IHRhcnNpZXJJZCkge1xyXG4gICAgICAgIHNpYmxpbmdfaW5kZXgrKztcclxuICAgICAgfVxyXG4gICAgICBzaWJsaW5nID0gc2libGluZy5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIC8vIENoZWNrIG5leHQgc2libGluZ3MgdG8gZGV0ZXJtaW5lIGlmIGluZGV4IHNob3VsZCBiZSBhZGRlZFxyXG4gICAgbGV0IG5leHRTaWJsaW5nID0gZWxlbWVudC5uZXh0RWxlbWVudFNpYmxpbmc7XHJcbiAgICBsZXQgc2hvdWxkQWRkSW5kZXggPSBmYWxzZTtcclxuICAgIHdoaWxlIChuZXh0U2libGluZykge1xyXG4gICAgICBpZiAobmV4dFNpYmxpbmcudGFnTmFtZSA9PT0gZWxlbWVudC50YWdOYW1lKSB7XHJcbiAgICAgICAgc2hvdWxkQWRkSW5kZXggPSB0cnVlO1xyXG4gICAgICAgIGJyZWFrO1xyXG4gICAgICB9XHJcbiAgICAgIG5leHRTaWJsaW5nID0gbmV4dFNpYmxpbmcubmV4dEVsZW1lbnRTaWJsaW5nO1xyXG4gICAgfVxyXG5cclxuICAgIGlmIChzaWJsaW5nX2luZGV4ID4gMSB8fCBzaG91bGRBZGRJbmRleCkge1xyXG4gICAgICBwcmVmaXggKz0gYFske3NpYmxpbmdfaW5kZXh9XWA7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKGVsZW1lbnQuaWQpIHtcclxuICAgICAgcHJlZml4ICs9IGBbQGlkPVwiJHtlbGVtZW50LmlkfVwiXWA7XHJcblxyXG4gICAgICAvLyBJZiB0aGUgaWQgaXMgdW5pcXVlIGFuZCB3ZSBoYXZlIGVub3VnaCBwYXRoIHBhcnRzLCB3ZSBjYW4gc3RvcFxyXG4gICAgICBpZiAocGF0aF9wYXJ0cy5sZW5ndGggPiAzKSB7XHJcbiAgICAgICAgcGF0aF9wYXJ0cy51bnNoaWZ0KHByZWZpeCk7XHJcbiAgICAgICAgcmV0dXJuIFwiLy9cIiArIHBhdGhfcGFydHMuam9pbihcIi9cIik7XHJcbiAgICAgIH1cclxuICAgIH0gZWxzZSBpZiAoZWxlbWVudC5jbGFzc05hbWUpIHtcclxuICAgICAgcHJlZml4ICs9IGBbQGNsYXNzPVwiJHtlbGVtZW50LmNsYXNzTmFtZX1cIl1gO1xyXG4gICAgfVxyXG5cclxuICAgIHBhdGhfcGFydHMudW5zaGlmdChwcmVmaXgpO1xyXG4gICAgZWxlbWVudCA9IGVsZW1lbnQucGFyZW50Tm9kZSBhcyBIVE1MRWxlbWVudCB8IG51bGw7XHJcbiAgfVxyXG4gIHJldHVybiBpZnJhbWVfc3RyICsgXCIvL1wiICsgcGF0aF9wYXJ0cy5qb2luKFwiL1wiKTtcclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlX3RhZ2dlZF9zcGFuKGlkTnVtOiBudW1iZXIsIGVsOiBIVE1MRWxlbWVudCkge1xyXG4gIGxldCBpZFN0cjogc3RyaW5nO1xyXG4gIGlmIChpc0ludGVyYWN0YWJsZShlbCkpIHtcclxuICAgIGlmIChpc1RleHRJbnNlcnRhYmxlKGVsKSkgaWRTdHIgPSBgWyMke2lkTnVtfV1gO1xyXG4gICAgZWxzZSBpZiAoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09IFwiYVwiKSBpZFN0ciA9IGBbQCR7aWROdW19XWA7XHJcbiAgICBlbHNlIGlkU3RyID0gYFskJHtpZE51bX1dYDtcclxuICB9IGVsc2Uge1xyXG4gICAgaWRTdHIgPSBgWyR7aWROdW19XWA7XHJcbiAgfVxyXG5cclxuICBsZXQgaWRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XHJcbiAgaWRTcGFuLmlkID0gdGFyc2llcklkO1xyXG4gIGlkU3Bhbi5zdHlsZS5wb3NpdGlvbiA9IFwicmVsYXRpdmVcIjtcclxuICBpZFNwYW4uc3R5bGUuZGlzcGxheSA9IFwiaW5saW5lXCI7XHJcbiAgaWRTcGFuLnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcInJlZFwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5wYWRkaW5nID0gXCIxLjVweFwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5ib3JkZXJSYWRpdXMgPSBcIjNweFwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5mb250V2VpZ2h0ID0gXCJib2xkXCI7XHJcbiAgLy8gaWRTcGFuLnN0eWxlLmZvbnRTaXplID0gXCIxNXB4XCI7IC8vIFJlbW92aW5nIGJlY2F1c2UgT0NSIHdvbid0IHNlZSBzbWFsbCB0ZXh0IGFtb25nIGxhcmdlIGZvbnRcclxuICBpZFNwYW4uc3R5bGUuZm9udEZhbWlseSA9IFwiQXJpYWxcIjtcclxuICBpZFNwYW4uc3R5bGUubWFyZ2luID0gXCIxcHhcIjtcclxuICBpZFNwYW4uc3R5bGUubGluZUhlaWdodCA9IFwiMS4yNVwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5sZXR0ZXJTcGFjaW5nID0gXCIycHhcIjtcclxuICBpZFNwYW4uc3R5bGUuekluZGV4ID0gXCIyMTQwMDAwMDQ2XCI7XHJcbiAgaWRTcGFuLnN0eWxlLmNsaXAgPSBcImF1dG9cIjtcclxuICBpZFNwYW4uc3R5bGUuaGVpZ2h0ID0gXCJmaXQtY29udGVudFwiO1xyXG4gIGlkU3Bhbi5zdHlsZS53aWR0aCA9IFwiZml0LWNvbnRlbnRcIjtcclxuICBpZFNwYW4uc3R5bGUubWluSGVpZ2h0ID0gXCIxNXB4XCI7XHJcbiAgaWRTcGFuLnN0eWxlLm1pbldpZHRoID0gXCIyM3B4XCI7XHJcbiAgaWRTcGFuLnN0eWxlLm1heEhlaWdodCA9IFwidW5zZXRcIjtcclxuICBpZFNwYW4uc3R5bGUubWF4V2lkdGggPSBcInVuc2V0XCI7XHJcbiAgaWRTcGFuLnRleHRDb250ZW50ID0gaWRTdHI7XHJcbiAgaWRTcGFuLnN0eWxlLndlYmtpdFRleHRGaWxsQ29sb3IgPSBcIndoaXRlXCI7XHJcbiAgaWRTcGFuLnN0eWxlLnRleHRTaGFkb3cgPSBcIlwiO1xyXG4gIGlkU3Bhbi5zdHlsZS50ZXh0RGVjb3JhdGlvbiA9IFwibm9uZVwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5sZXR0ZXJTcGFjaW5nID0gXCIwcHhcIjtcclxuXHJcbiAgaWRTcGFuLnNldEF0dHJpYnV0ZSh0YXJzaWVyRGF0YUF0dHJpYnV0ZSwgaWROdW0udG9TdHJpbmcoKSk7XHJcblxyXG4gIHJldHVybiBpZFNwYW47XHJcbn1cclxuXHJcbmNvbnN0IE1JTl9GT05UX1NJWkUgPSAxMTtcclxuY29uc3QgZW5zdXJlTWluaW11bVRhZ0ZvbnRTaXplcyA9ICgpID0+IHtcclxuICBjb25zdCB0YWdzID0gQXJyYXkuZnJvbShcclxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwodGFyc2llclNlbGVjdG9yKSxcclxuICApIGFzIEhUTUxFbGVtZW50W107XHJcbiAgdGFncy5mb3JFYWNoKCh0YWcpID0+IHtcclxuICAgIGxldCBmb250U2l6ZSA9IHBhcnNlRmxvYXQoXHJcbiAgICAgIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRhZykuZm9udFNpemUuc3BsaXQoXCJweFwiKVswXSxcclxuICAgICk7XHJcbiAgICBpZiAoZm9udFNpemUgPCBNSU5fRk9OVF9TSVpFKSB7XHJcbiAgICAgIHRhZy5zdHlsZS5mb250U2l6ZSA9IGAke01JTl9GT05UX1NJWkV9cHhgO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59O1xyXG5cclxud2luZG93LnRhZ2lmeVdlYnBhZ2UgPSAodGFnTGVhZlRleHRzID0gdHJ1ZSkgPT4ge1xyXG4gIHdpbmRvdy5yZW1vdmVUYWdzKCk7XHJcbiAgaGlkZU1hcEVsZW1lbnRzKCk7XHJcblxyXG4gIGNvbnN0IGFsbEVsZW1lbnRzID0gZ2V0QWxsRWxlbWVudHNJbkFsbEZyYW1lcygpO1xyXG4gIGNvbnN0IHJhd0VsZW1lbnRzVG9UYWcgPSBnZXRFbGVtZW50c1RvVGFnKGFsbEVsZW1lbnRzLCB0YWdMZWFmVGV4dHMpO1xyXG4gIGNvbnN0IGVsZW1lbnRzVG9UYWcgPSByZW1vdmVOZXN0ZWRUYWdzKHJhd0VsZW1lbnRzVG9UYWcpO1xyXG4gIGNvbnN0IGlkVG9UYWdNZXRhID0gaW5zZXJ0VGFncyhlbGVtZW50c1RvVGFnLCB0YWdMZWFmVGV4dHMpO1xyXG4gIHNocmlua0NvbGxpZGluZ1RhZ3MoKTtcclxuICBlbnN1cmVNaW5pbXVtVGFnRm9udFNpemVzKCk7XHJcblxyXG4gIHZhciByZXMgPSBPYmplY3QuZW50cmllcyhpZFRvVGFnTWV0YSkucmVkdWNlKFxyXG4gICAgKGFjYywgW2lkLCBtZXRhXSkgPT4ge1xyXG4gICAgICBhY2NbcGFyc2VJbnQoaWQpXSA9IG1ldGFcclxuICAgICAgcmV0dXJuIGFjYztcclxuICAgIH0sXHJcbiAgICB7fSBhcyB7IFtrZXk6IG51bWJlcl06IFRhZ01ldGFkYXRhIH0sXHJcbiAgKTtcclxuXHJcbiAgLy8gcmVzID0+IGFycmF5IG9mIG9iamVjdHNcclxuICB2YXIgYXJyYXkgPSBPYmplY3QudmFsdWVzKHJlcyk7XHJcbiAgcmV0dXJuIHsgZGF0YTogYXJyYXkgfTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIGdldEFsbEVsZW1lbnRzSW5BbGxGcmFtZXMoKTogSFRNTEVsZW1lbnRbXSB7XHJcbiAgLy8gTWFpbiBwYWdlXHJcbiAgY29uc3QgYWxsRWxlbWVudHM6IEhUTUxFbGVtZW50W10gPSBBcnJheS5mcm9tKFxyXG4gICAgZG9jdW1lbnQuYm9keS5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKSxcclxuICApO1xyXG5cclxuICAvLyBBZGQgYWxsIGVsZW1lbnRzIGluIGlmcmFtZXNcclxuICAvLyBOT1RFOiBUaGlzIHN0aWxsIGRvZXNuJ3Qgd29yayBmb3IgYWxsIGlmcmFtZXNcclxuICBjb25zdCBpZnJhbWVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpZnJhbWVcIik7XHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpZnJhbWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBmcmFtZSA9IGlmcmFtZXNbaV07XHJcbiAgICAgIGNvbnN0IGlmcmFtZURvY3VtZW50ID1cclxuICAgICAgICBmcmFtZS5jb250ZW50RG9jdW1lbnQgfHwgZnJhbWUuY29udGVudFdpbmRvdz8uZG9jdW1lbnQ7XHJcbiAgICAgIGlmICghaWZyYW1lRG9jdW1lbnQpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgaWZyYW1lRWxlbWVudHMgPSBBcnJheS5mcm9tKFxyXG4gICAgICAgIGlmcmFtZURvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpLFxyXG4gICAgICApIGFzIEhUTUxFbGVtZW50W107XHJcbiAgICAgIGlmcmFtZUVsZW1lbnRzLmZvckVhY2goKGVsKSA9PlxyXG4gICAgICAgIGVsLnNldEF0dHJpYnV0ZShcImlmcmFtZV9pbmRleFwiLCBpLnRvU3RyaW5nKCkpLFxyXG4gICAgICApO1xyXG4gICAgICBhbGxFbGVtZW50cy5wdXNoKC4uLmlmcmFtZUVsZW1lbnRzKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGFjY2Vzc2luZyBpZnJhbWUgY29udGVudDpcIiwgZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gYWxsRWxlbWVudHM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEVsZW1lbnRzVG9UYWcoXHJcbiAgYWxsRWxlbWVudHM6IEhUTUxFbGVtZW50W10sXHJcbiAgdGFnTGVhZlRleHRzOiBib29sZWFuLFxyXG4pOiBIVE1MRWxlbWVudFtdIHtcclxuICBjb25zdCBlbGVtZW50c1RvVGFnOiBIVE1MRWxlbWVudFtdID0gW107XHJcblxyXG4gIGZvciAobGV0IGVsIG9mIGFsbEVsZW1lbnRzKSB7XHJcbiAgICBpZiAoaXNUZXh0TGVzcyhlbCkgfHwgIWVsSXNWaXNpYmxlKGVsKSkge1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXNJbnRlcmFjdGFibGUoZWwpKSB7XHJcbiAgICAgIGVsZW1lbnRzVG9UYWcucHVzaChlbCk7XHJcbiAgICB9IGVsc2UgaWYgKHRhZ0xlYWZUZXh0cykge1xyXG4gICAgICAvLyBBcHBlbmQgdGhlIHBhcmVudCB0YWcgYXMgaXQgbWF5IGhhdmUgbXVsdGlwbGUgaW5kaXZpZHVhbCBjaGlsZCBub2RlcyB3aXRoIHRleHRcclxuICAgICAgLy8gV2Ugd2lsbCB0YWcgdGhlbSBpbmRpdmlkdWFsbHkgbGF0ZXJcclxuICAgICAgaWYgKEFycmF5LmZyb20oZWwuY2hpbGROb2RlcykuZmlsdGVyKGlzVGFnZ2FibGVUZXh0Tm9kZSkubGVuZ3RoID49IDEpIHtcclxuICAgICAgICBlbGVtZW50c1RvVGFnLnB1c2goZWwpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZWxlbWVudHNUb1RhZztcclxufVxyXG5cclxuZnVuY3Rpb24gcmVtb3ZlTmVzdGVkVGFncyhlbGVtZW50c1RvVGFnOiBIVE1MRWxlbWVudFtdKTogSFRNTEVsZW1lbnRbXSB7XHJcbiAgLy8gQW4gaW50ZXJhY3RhYmxlIGVsZW1lbnQgbWF5IGhhdmUgbXVsdGlwbGUgdGFnZ2VkIGVsZW1lbnRzIGluc2lkZVxyXG4gIC8vIE1vc3QgY29tbW9ubHksIHRoZSB0ZXh0IHdpbGwgYmUgdGFnZ2VkIGFsb25nc2lkZSB0aGUgaW50ZXJhY3RhYmxlIGVsZW1lbnRcclxuICAvLyBJbiB0aGlzIGNhc2UgdGhlcmUgaXMgb25seSBvbmUgY2hpbGQsIGFuZCB3ZSBzaG91bGQgcmVtb3ZlIHRoaXMgbmVzdGVkIHRhZ1xyXG4gIC8vIEluIG90aGVyIGNhc2VzLCB3ZSB3aWxsIGFsbG93IGZvciB0aGUgbmVzdGVkIHRhZ2dpbmdcclxuXHJcbiAgY29uc3QgcmVzID0gWy4uLmVsZW1lbnRzVG9UYWddO1xyXG4gIGVsZW1lbnRzVG9UYWcubWFwKChlbCkgPT4ge1xyXG4gICAgLy8gT25seSBpbnRlcmFjdGFibGUgZWxlbWVudHMgY2FuIGhhdmUgbmVzdGVkIHRhZ3NcclxuICAgIGlmIChpc0ludGVyYWN0YWJsZShlbCkpIHtcclxuICAgICAgY29uc3QgZWxlbWVudHNUb1JlbW92ZTogSFRNTEVsZW1lbnRbXSA9IFtdO1xyXG4gICAgICBlbC5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKS5mb3JFYWNoKChjaGlsZCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGluZGV4ID0gcmVzLmluZGV4T2YoY2hpbGQgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgIGlmIChpbmRleCA+IC0xKSB7XHJcbiAgICAgICAgICBlbGVtZW50c1RvUmVtb3ZlLnB1c2goY2hpbGQgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBPbmx5IHJlbW92ZSBuZXN0ZWQgdGFncyBpZiB0aGVyZSBpcyBvbmx5IGEgc2luZ2xlIGVsZW1lbnQgdG8gcmVtb3ZlXHJcbiAgICAgIGlmIChlbGVtZW50c1RvUmVtb3ZlLmxlbmd0aCA8PSAyKSB7XHJcbiAgICAgICAgZm9yIChsZXQgZWxlbWVudCBvZiBlbGVtZW50c1RvUmVtb3ZlKSB7XHJcbiAgICAgICAgICByZXMuc3BsaWNlKHJlcy5pbmRleE9mKGVsZW1lbnQpLCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIHJlcztcclxufVxyXG5cclxuZnVuY3Rpb24gaW5zZXJ0VGFncyhcclxuICBlbGVtZW50c1RvVGFnOiBIVE1MRWxlbWVudFtdLFxyXG4gIHRhZ0xlYWZUZXh0czogYm9vbGVhbixcclxuKTogeyBba2V5OiBudW1iZXJdOiBUYWdNZXRhZGF0YSB9IHtcclxuICBmdW5jdGlvbiB0cmltVGV4dE5vZGVTdGFydChlbGVtZW50OiBIVE1MRWxlbWVudCkge1xyXG4gICAgLy8gVHJpbSBsZWFkaW5nIHdoaXRlc3BhY2UgZnJvbSB0aGUgZWxlbWVudCdzIHRleHQgY29udGVudFxyXG4gICAgLy8gVGhpcyB3YXksIHRoZSB0YWcgd2lsbCBiZSBpbmxpbmUgd2l0aCB0aGUgd29yZCBhbmQgbm90IHRleHR3cmFwXHJcbiAgICAvLyBFbGVtZW50IHRleHRcclxuICAgIGlmICghZWxlbWVudC5maXJzdENoaWxkIHx8IGVsZW1lbnQuZmlyc3RDaGlsZC5ub2RlVHlwZSAhPT0gTm9kZS5URVhUX05PREUpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgdGV4dE5vZGUgPSBlbGVtZW50LmZpcnN0Q2hpbGQgYXMgVGV4dDtcclxuICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gdGV4dE5vZGUudGV4dENvbnRlbnQhLnRyaW1TdGFydCgpO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gZ2V0RWxlbWVudFRvSW5zZXJ0SW50byhcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50LFxyXG4gICAgaWRTcGFuOiBIVE1MU3BhbkVsZW1lbnQsXHJcbiAgKTogSFRNTEVsZW1lbnQge1xyXG4gICAgLy8gQW4gPGE+IHRhZyBtYXkganVzdCBiZSBhIHdyYXBwZXIgb3ZlciBtYW55IGVsZW1lbnRzLiAoVGhpbmsgYW4gPGE+IHdpdGggYSA8c3Bhbj4gYW5kIGFub3RoZXIgPHNwYW4+XHJcbiAgICAvLyBJZiB0aGVzZSBzdWIgY2hpbGRyZW4gYXJlIHRoZSBvbmx5IGNoaWxkcmVuLCB0aGV5IG1pZ2h0IGhhdmUgc3R5bGluZyB0aGF0IG1pcy1wb3NpdGlvbnMgdGhlIHRhZyB3ZSdyZSBhdHRlbXB0aW5nIHRvXHJcbiAgICAvLyBpbnNlcnQuIEJlY2F1c2Ugb2YgdGhpcywgd2Ugc2hvdWxkIGRyaWxsIGRvd24gYW1vbmcgdGhlc2Ugc2luZ2xlIGNoaWxkcmVuIHRvIGluc2VydCB0aGlzIHRhZ1xyXG5cclxuICAgIC8vIFNvbWUgZWxlbWVudHMgbWlnaHQganVzdCBiZSBlbXB0eS4gVGhleSBzaG91bGQgbm90IGNvdW50IGFzIFwiY2hpbGRyZW5cIiBhbmQgaWYgdGhlcmUgYXJlIGNhbmRpZGF0ZXMgdG8gZHJpbGwgZG93blxyXG4gICAgLy8gaW50byB3aGVuIHRoZXNlIGVtcHR5IGVsZW1lbnRzIGFyZSBjb25zaWRlcmVkLCB3ZSBzaG91bGQgZHJpbGxcclxuICAgIGNvbnN0IGNoaWxkcmVuVG9Db25zaWRlciA9IEFycmF5LmZyb20oZWxlbWVudC5jaGlsZE5vZGVzKS5maWx0ZXIoXHJcbiAgICAgIChjaGlsZCkgPT4ge1xyXG4gICAgICAgIGlmIChpc05vbldoaXRlU3BhY2VUZXh0Tm9kZShjaGlsZCkpIHtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoY2hpbGQubm9kZVR5cGUgPT09IE5vZGUuVEVYVF9OT0RFKSB7XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gIShcclxuICAgICAgICAgIGNoaWxkLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSAmJlxyXG4gICAgICAgICAgKGlzVGV4dExlc3MoY2hpbGQgYXMgSFRNTEVsZW1lbnQpIHx8XHJcbiAgICAgICAgICAgICFlbElzVmlzaWJsZShjaGlsZCBhcyBIVE1MRWxlbWVudCkpXHJcbiAgICAgICAgKTtcclxuICAgICAgfSxcclxuICAgICk7XHJcblxyXG4gICAgaWYgKGNoaWxkcmVuVG9Db25zaWRlci5sZW5ndGggPT09IDEpIHtcclxuICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZHJlblRvQ29uc2lkZXJbMF07XHJcbiAgICAgIC8vIEFsc28gY2hlY2sgaXRzIGEgc3BhbiBvciBQIHRhZ1xyXG4gICAgICBjb25zdCBlbGVtZW50c1RvRHJpbGxEb3duID0gW1xyXG4gICAgICAgIFwiZGl2XCIsXHJcbiAgICAgICAgXCJzcGFuXCIsXHJcbiAgICAgICAgXCJwXCIsXHJcbiAgICAgICAgXCJoMVwiLFxyXG4gICAgICAgIFwiaDJcIixcclxuICAgICAgICBcImgzXCIsXHJcbiAgICAgICAgXCJoNFwiLFxyXG4gICAgICAgIFwiaDVcIixcclxuICAgICAgICBcImg2XCIsXHJcbiAgICAgIF07XHJcbiAgICAgIGlmIChcclxuICAgICAgICBjaGlsZC5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUgJiZcclxuICAgICAgICBlbGVtZW50c1RvRHJpbGxEb3duLmluY2x1ZGVzKFxyXG4gICAgICAgICAgKGNoaWxkIGFzIEhUTUxFbGVtZW50KS50YWdOYW1lLnRvTG93ZXJDYXNlKCksXHJcbiAgICAgICAgKVxyXG4gICAgICApIHtcclxuICAgICAgICByZXR1cm4gZ2V0RWxlbWVudFRvSW5zZXJ0SW50byhjaGlsZCBhcyBIVE1MRWxlbWVudCwgaWRTcGFuKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRyaW1UZXh0Tm9kZVN0YXJ0KGVsZW1lbnQpO1xyXG5cclxuICAgIC8vIEJhc2UgY2FzZVxyXG4gICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgfVxyXG5cclxuICBjb25zdCBpZFRvVGFnTWV0YWRhdGE6IHsgW2tleTogbnVtYmVyXTogVGFnTWV0YWRhdGEgfSA9IHt9O1xyXG4gIGxldCBpZE51bSA9IDA7XHJcblxyXG4gIGZvciAobGV0IGVsIG9mIGVsZW1lbnRzVG9UYWcpIHtcclxuICAgIGlkVG9UYWdNZXRhZGF0YVtpZE51bV0gPSB7XHJcbiAgICAgIHhwYXRoOiBnZXRFbGVtZW50WFBhdGgoZWwpLFxyXG4gICAgICBhcmlhTGFiZWw6IGVsLmdldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIikgfHwgdW5kZWZpbmVkLFxyXG4gICAgICBsYWJlbDogaWROdW0udG9TdHJpbmcoKSxcclxuICAgIH07XHJcblxyXG4gICAgaWYgKGlzSW50ZXJhY3RhYmxlKGVsKSkge1xyXG4gICAgICBjb25zdCBpZFNwYW4gPSBjcmVhdGVfdGFnZ2VkX3NwYW4oaWROdW0sIGVsKTtcclxuICAgICAgaWYgKGlzVGV4dEluc2VydGFibGUoZWwpICYmIGVsLnBhcmVudEVsZW1lbnQpIHtcclxuICAgICAgICBlbC5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShpZFNwYW4sIGVsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zdCBpbnNlcnRpb25FbGVtZW50ID0gZ2V0RWxlbWVudFRvSW5zZXJ0SW50byhlbCwgaWRTcGFuKTtcclxuICAgICAgICBpbnNlcnRpb25FbGVtZW50LnByZXBlbmQoaWRTcGFuKTtcclxuICAgICAgICBhYnNvbHV0ZWx5UG9zaXRpb25UYWdJZk1pc2FsaWduZWQoaWRTcGFuLCBpbnNlcnRpb25FbGVtZW50KTtcclxuICAgICAgfVxyXG4gICAgICBpZE51bSsrO1xyXG4gICAgfSBlbHNlIGlmICh0YWdMZWFmVGV4dHMpIHtcclxuICAgICAgdHJpbVRleHROb2RlU3RhcnQoZWwpO1xyXG4gICAgICBjb25zdCB2YWxpZFRleHROb2RlcyA9IEFycmF5LmZyb20oZWwuY2hpbGROb2RlcykuZmlsdGVyKFxyXG4gICAgICAgIGlzVGFnZ2FibGVUZXh0Tm9kZSxcclxuICAgICAgKTtcclxuICAgICAgY29uc3QgYWxsVGV4dE5vZGVzID0gQXJyYXkuZnJvbShlbC5jaGlsZE5vZGVzKS5maWx0ZXIoXHJcbiAgICAgICAgKGNoaWxkKSA9PiBjaGlsZC5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUsXHJcbiAgICAgICk7XHJcbiAgICAgIGZvciAobGV0IGNoaWxkIG9mIHZhbGlkVGV4dE5vZGVzKSB7XHJcbiAgICAgICAgY29uc3QgcGFyZW50WFBhdGggPSBnZXRFbGVtZW50WFBhdGgoZWwpO1xyXG4gICAgICAgIGNvbnN0IHRleHROb2RlSW5kZXggPSBhbGxUZXh0Tm9kZXMuaW5kZXhPZihjaGlsZCkgKyAxO1xyXG5cclxuICAgICAgICBpZFRvVGFnTWV0YWRhdGFbaWROdW1dID0ge1xyXG4gICAgICAgICAgeHBhdGg6IHBhcmVudFhQYXRoLFxyXG4gICAgICAgICAgdGV4dE5vZGVJbmRleDogdGV4dE5vZGVJbmRleCxcclxuICAgICAgICAgIGxhYmVsOiBpZE51bS50b1N0cmluZygpLFxyXG4gICAgICAgICAgYXJpYUxhYmVsOiBlbC5nZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIpIHx8IHVuZGVmaW5lZCxcclxuICAgICAgICB9O1xyXG5cclxuICAgICAgICBjb25zdCBpZFNwYW4gPSBjcmVhdGVfdGFnZ2VkX3NwYW4oaWROdW0sIGVsKTtcclxuICAgICAgICBlbC5pbnNlcnRCZWZvcmUoaWRTcGFuLCBjaGlsZCk7XHJcbiAgICAgICAgaWROdW0rKztcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxuXHJcbiAgcmV0dXJuIGlkVG9UYWdNZXRhZGF0YTtcclxufVxyXG5cclxuZnVuY3Rpb24gYWJzb2x1dGVseVBvc2l0aW9uVGFnSWZNaXNhbGlnbmVkKFxyXG4gIHRhZzogSFRNTEVsZW1lbnQsXHJcbiAgcmVmZXJlbmNlOiBIVE1MRWxlbWVudCxcclxuKSB7XHJcbiAgLypcclxuICBTb21lIHRhZ3MgZG9uJ3QgZ2V0IGRpc3BsYXllZCBvbiB0aGUgcGFnZSBwcm9wZXJseVxyXG4gIFRoaXMgb2NjdXJzIGlmIHRoZSBwYXJlbnQgZWxlbWVudCBjaGlsZHJlbiBhcmUgZGlzam9pbnRlZCBmcm9tIHRoZSBwYXJlbnRcclxuICBJbiB0aGlzIGNhc2UsIHdlIGFic29sdXRlbHkgcG9zaXRpb24gdGhlIHRhZyB0byB0aGUgcGFyZW50IGVsZW1lbnRcclxuICAqL1xyXG5cclxuICBsZXQgdGFnUmVjdCA9IHRhZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICBpZiAoISh0YWdSZWN0LndpZHRoID09PSAwIHx8IHRhZ1JlY3QuaGVpZ2h0ID09PSAwKSkge1xyXG4gICAgcmV0dXJuO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgZGlzdGFuY2VUaHJlc2hvbGQgPSAyNTA7XHJcblxyXG4gIC8vIENoZWNrIGlmIHRoZSBleHBlY3RlZCBwb3NpdGlvbiBpcyBvZmYtc2NyZWVuIGhvcml6b250YWxseVxyXG4gIGNvbnN0IGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0ID0gcmVmZXJlbmNlLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gIGlmIChcclxuICAgIGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0LnJpZ2h0IDwgMCB8fFxyXG4gICAgZXhwZWN0ZWRUYWdQb3NpdGlvblJlY3QubGVmdCA+XHJcbiAgICAgICh3aW5kb3cuaW5uZXJXaWR0aCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuY2xpZW50V2lkdGgpXHJcbiAgKSB7XHJcbiAgICAvLyBFeHBlY3RlZCBwb3NpdGlvbiBpcyBvZmYtc2NyZWVuIGhvcml6b250YWxseSwgcmVtb3ZlIHRoZSB0YWdcclxuICAgIHRhZy5yZW1vdmUoKTtcclxuICAgIHJldHVybjsgLy8gU2tpcCB0byB0aGUgbmV4dCB0YWdcclxuICB9XHJcblxyXG4gIGNvbnN0IHJlZmVyZW5jZVRvcExlZnQgPSB7XHJcbiAgICB4OiBleHBlY3RlZFRhZ1Bvc2l0aW9uUmVjdC5sZWZ0LFxyXG4gICAgeTogZXhwZWN0ZWRUYWdQb3NpdGlvblJlY3QudG9wLFxyXG4gIH07XHJcblxyXG4gIGNvbnN0IHRhZ0NlbnRlciA9IHtcclxuICAgIHg6ICh0YWdSZWN0LmxlZnQgKyB0YWdSZWN0LnJpZ2h0KSAvIDIsXHJcbiAgICB5OiAodGFnUmVjdC50b3AgKyB0YWdSZWN0LmJvdHRvbSkgLyAyLFxyXG4gIH07XHJcblxyXG4gIGNvbnN0IGR4ID0gTWF0aC5hYnMocmVmZXJlbmNlVG9wTGVmdC54IC0gdGFnQ2VudGVyLngpO1xyXG4gIGNvbnN0IGR5ID0gTWF0aC5hYnMocmVmZXJlbmNlVG9wTGVmdC55IC0gdGFnQ2VudGVyLnkpO1xyXG4gIGlmIChkeCA+IGRpc3RhbmNlVGhyZXNob2xkIHx8IGR5ID4gZGlzdGFuY2VUaHJlc2hvbGQgfHwgIWVsSXNWaXNpYmxlKHRhZykpIHtcclxuICAgIHRhZy5zdHlsZS5wb3NpdGlvbiA9IFwiYWJzb2x1dGVcIjtcclxuXHJcbiAgICAvLyBFbnN1cmUgdGhlIHRhZyBpcyBwb3NpdGlvbmVkIHdpdGhpbiB0aGUgc2NyZWVuIGJvdW5kc1xyXG4gICAgbGV0IGxlZnRQb3NpdGlvbiA9IE1hdGgubWF4KFxyXG4gICAgICAwLFxyXG4gICAgICBleHBlY3RlZFRhZ1Bvc2l0aW9uUmVjdC5sZWZ0IC0gKHRhZ1JlY3QucmlnaHQgKyAzIC0gdGFnUmVjdC5sZWZ0KSxcclxuICAgICk7XHJcbiAgICBsZWZ0UG9zaXRpb24gPSBNYXRoLm1pbihcclxuICAgICAgbGVmdFBvc2l0aW9uLFxyXG4gICAgICB3aW5kb3cuaW5uZXJXaWR0aCAtICh0YWdSZWN0LnJpZ2h0IC0gdGFnUmVjdC5sZWZ0KSxcclxuICAgICk7XHJcbiAgICBsZXQgdG9wUG9zaXRpb24gPSBNYXRoLm1heCgwLCBleHBlY3RlZFRhZ1Bvc2l0aW9uUmVjdC50b3AgKyAzKTsgLy8gQWRkIHNvbWUgdG9wIGJ1ZmZlciB0byBjZW50ZXIgYWxpZ24gYmV0dGVyXHJcbiAgICB0b3BQb3NpdGlvbiA9IE1hdGgubWluKFxyXG4gICAgICB0b3BQb3NpdGlvbixcclxuICAgICAgTWF0aC5tYXgod2luZG93LmlubmVySGVpZ2h0LCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQuc2Nyb2xsSGVpZ2h0KSAtXHJcbiAgICAgICAgKHRhZ1JlY3QuYm90dG9tIC0gdGFnUmVjdC50b3ApLFxyXG4gICAgKTtcclxuXHJcbiAgICB0YWcuc3R5bGUubGVmdCA9IGAke2xlZnRQb3NpdGlvbn1weGA7XHJcbiAgICB0YWcuc3R5bGUudG9wID0gYCR7dG9wUG9zaXRpb259cHhgO1xyXG5cclxuICAgIHRhZy5wYXJlbnRFbGVtZW50ICYmIHRhZy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRhZyk7XHJcbiAgICBkb2N1bWVudC5ib2R5LmFwcGVuZENoaWxkKHRhZyk7XHJcbiAgfVxyXG59XHJcblxyXG5jb25zdCBzaHJpbmtDb2xsaWRpbmdUYWdzID0gKCkgPT4ge1xyXG4gIGNvbnN0IHRhZ3MgPSBBcnJheS5mcm9tKFxyXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbCh0YXJzaWVyU2VsZWN0b3IpLFxyXG4gICkgYXMgSFRNTEVsZW1lbnRbXTtcclxuICBmb3IgKGxldCBpID0gMDsgaSA8IHRhZ3MubGVuZ3RoOyBpKyspIHtcclxuICAgIGNvbnN0IHRhZyA9IHRhZ3NbaV07XHJcbiAgICBsZXQgdGFnUmVjdCA9IHRhZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgIGxldCBmb250U2l6ZSA9IHBhcnNlRmxvYXQoXHJcbiAgICAgIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRhZykuZm9udFNpemUuc3BsaXQoXCJweFwiKVswXSxcclxuICAgICk7XHJcblxyXG4gICAgZm9yIChsZXQgaiA9IGkgKyAxOyBqIDwgdGFncy5sZW5ndGg7IGorKykge1xyXG4gICAgICBjb25zdCBvdGhlclRhZyA9IHRhZ3Nbal07XHJcbiAgICAgIGxldCBvdGhlclRhZ1JlY3QgPSBvdGhlclRhZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgbGV0IG90aGVyRm9udFNpemUgPSBwYXJzZUZsb2F0KFxyXG4gICAgICAgIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKG90aGVyVGFnKS5mb250U2l6ZS5zcGxpdChcInB4XCIpWzBdLFxyXG4gICAgICApO1xyXG5cclxuICAgICAgd2hpbGUgKFxyXG4gICAgICAgIHRhZ1JlY3QubGVmdCA8IG90aGVyVGFnUmVjdC5yaWdodCAmJlxyXG4gICAgICAgIHRhZ1JlY3QucmlnaHQgPiBvdGhlclRhZ1JlY3QubGVmdCAmJlxyXG4gICAgICAgIHRhZ1JlY3QudG9wIDwgb3RoZXJUYWdSZWN0LmJvdHRvbSAmJlxyXG4gICAgICAgIHRhZ1JlY3QuYm90dG9tID4gb3RoZXJUYWdSZWN0LnRvcCAmJlxyXG4gICAgICAgIGZvbnRTaXplID4gTUlOX0ZPTlRfU0laRSAmJlxyXG4gICAgICAgIG90aGVyRm9udFNpemUgPiBNSU5fRk9OVF9TSVpFXHJcbiAgICAgICkge1xyXG4gICAgICAgIGZvbnRTaXplIC09IDAuNTtcclxuICAgICAgICBvdGhlckZvbnRTaXplIC09IDAuNTtcclxuICAgICAgICB0YWcuc3R5bGUuZm9udFNpemUgPSBgJHtmb250U2l6ZX1weGA7XHJcbiAgICAgICAgb3RoZXJUYWcuc3R5bGUuZm9udFNpemUgPSBgJHtvdGhlckZvbnRTaXplfXB4YDtcclxuXHJcbiAgICAgICAgdGFnUmVjdCA9IHRhZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgICBvdGhlclRhZ1JlY3QgPSBvdGhlclRhZy5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG4gIH1cclxufTtcclxuXHJcbndpbmRvdy5yZW1vdmVUYWdzID0gKCkgPT4ge1xyXG4gIGNvbnN0IHRhZ3MgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHRhcnNpZXJTZWxlY3Rvcik7XHJcbiAgdGFncy5mb3JFYWNoKCh0YWcpID0+IHRhZy5yZW1vdmUoKSk7XHJcbiAgc2hvd01hcEVsZW1lbnRzKCk7XHJcbn07XHJcblxyXG5jb25zdCBHT09HTEVfTUFQU19PUEFDSVRZX0NPTlRST0wgPSBcIl9fcmV3b3JrZF9nb29nbGVfbWFwc19vcGFjaXR5XCI7XHJcblxyXG5jb25zdCBoaWRlTWFwRWxlbWVudHMgPSAoKTogdm9pZCA9PiB7XHJcbiAgLy8gTWFwcyBoYXZlIGxvdHMgb2YgdGlueSBidXR0b25zIHRoYXQgbmVlZCB0byBiZSB0YWdnZWRcclxuICAvLyBUaGV5IGFsc28gaGF2ZSBhIGxvdCBvZiB0aW55IHRleHQgYW5kIGFyZSBhbm5veWluZyB0byBkZWFsIHdpdGggZm9yIHJlbmRlcmluZ1xyXG4gIC8vIEFsc28gYW55IGVsZW1lbnQgd2l0aCBhcmlhLWxhYmVsPVwiTWFwXCIgYXJpYS1yb2xlZGVzY3JpcHRpb249XCJtYXBcIlxyXG4gIGNvbnN0IHNlbGVjdG9ycyA9IFtcclxuICAgICdpZnJhbWVbc3JjKj1cImdvb2dsZS5jb20vbWFwc1wiXScsXHJcbiAgICAnaWZyYW1lW2lkKj1cImdtYXBfY2FudmFzXCJdJyxcclxuICAgIFwiLm1hcGxpYnJlZ2wtbWFwXCIsXHJcbiAgICBcIi5tYXBib3hnbC1tYXBcIixcclxuICAgIFwiLmxlYWZsZXQtY29udGFpbmVyXCIsXHJcbiAgICAnaW1nW3NyYyo9XCJtYXBzLmdvb2dsZWFwaXMuY29tXCJdJyxcclxuICAgICdbYXJpYS1sYWJlbD1cIk1hcFwiXScsXHJcbiAgICBcIi5jbXAtbG9jYXRpb24tbWFwX19tYXBcIixcclxuICAgICcubWFwLXZpZXdbZGF0YS1yb2xlPVwibWFwVmlld1wiXScsXHJcbiAgICBcIi5nb29nbGVfTWFwLXdyYXBwZXJcIixcclxuICAgIFwiLmdvb2dsZV9tYXAtd3JhcHBlclwiLFxyXG4gICAgXCIuZ29vZ2xlTWFwLXdyYXBwZXJcIixcclxuICAgIFwiLmdvb2dsZW1hcC13cmFwcGVyXCIsXHJcbiAgICBcIi5scy1tYXAtY2FudmFzXCIsXHJcbiAgICBcIi5nbWFwY2x1c3RlclwiLFxyXG4gICAgXCIjZ29vZ2xlTWFwXCIsXHJcbiAgICBcIiNnb29nbGVNYXBzXCIsXHJcbiAgICBcIiNnb29nbGVtYXBzXCIsXHJcbiAgICBcIiNnb29nbGVtYXBcIixcclxuICAgIFwiI2dvb2dsZV9tYXBcIixcclxuICAgIFwiI2dvb2dsZV9tYXBzXCIsXHJcbiAgICBcIiNNYXBJZFwiLFxyXG4gICAgXCIuZ2VvbG9jYXRpb24tbWFwLXdyYXBwZXJcIixcclxuICAgIFwiLmxvY2F0b3JNYXBcIixcclxuICBdO1xyXG5cclxuICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHNlbGVjdG9ycy5qb2luKFwiLCBcIikpLmZvckVhY2goKGVsZW1lbnQpID0+IHtcclxuICAgIGNvbnN0IGN1cnJlbnRPcGFjaXR5ID0gd2luZG93LmdldENvbXB1dGVkU3R5bGUoZWxlbWVudCkub3BhY2l0eTtcclxuICAgIC8vIFN0b3JlIGN1cnJlbnQgb3BhY2l0eVxyXG4gICAgZWxlbWVudC5zZXRBdHRyaWJ1dGUoXCJkYXRhLW9yaWdpbmFsLW9wYWNpdHlcIiwgY3VycmVudE9wYWNpdHkpO1xyXG5cclxuICAgIChlbGVtZW50IGFzIEhUTUxFbGVtZW50KS5zdHlsZS5vcGFjaXR5ID0gXCIwXCI7XHJcbiAgfSk7XHJcbn07XHJcblxyXG5jb25zdCBzaG93TWFwRWxlbWVudHMgPSAoKSA9PiB7XHJcbiAgY29uc3QgZWxlbWVudHMgPSBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFxyXG4gICAgYFske0dPT0dMRV9NQVBTX09QQUNJVFlfQ09OVFJPTH1dYCxcclxuICApO1xyXG4gIGVsZW1lbnRzLmZvckVhY2goKGVsZW1lbnQpID0+IHtcclxuICAgIChlbGVtZW50IGFzIEhUTUxFbGVtZW50KS5zdHlsZS5vcGFjaXR5ID1cclxuICAgICAgZWxlbWVudC5nZXRBdHRyaWJ1dGUoXCJkYXRhLW9yaWdpbmFsLW9wYWNpdHlcIikgfHwgXCIxXCI7XHJcbiAgfSk7XHJcbn07XHJcblxyXG53aW5kb3cuaGlkZU5vblRhZ0VsZW1lbnRzID0gKCkgPT4ge1xyXG4gIGNvbnN0IGFsbEVsZW1lbnRzID0gZ2V0QWxsRWxlbWVudHNJbkFsbEZyYW1lcygpO1xyXG4gIGFsbEVsZW1lbnRzLmZvckVhY2goKGVsKSA9PiB7XHJcbiAgICBjb25zdCBlbGVtZW50ID0gZWwgYXMgSFRNTEVsZW1lbnQ7XHJcblxyXG4gICAgaWYgKGVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSkge1xyXG4gICAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShcclxuICAgICAgICByZXdvcmtkVmlzaWJpbGl0eUF0dHJpYnV0ZSxcclxuICAgICAgICBlbGVtZW50LnN0eWxlLnZpc2liaWxpdHksXHJcbiAgICAgICk7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKCFlbGVtZW50LmlkLnN0YXJ0c1dpdGgodGFyc2llcklkKSkge1xyXG4gICAgICBlbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSBcImhpZGRlblwiO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID0gXCJ2aXNpYmxlXCI7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn07XHJcblxyXG53aW5kb3cuZml4TmFtZXNwYWNlcyA9ICh0YWdOYW1lOiBzdHJpbmcpOiBzdHJpbmcgPT4ge1xyXG4gIC8vIE5hbWVzcGFjZXMgaW4gWE1MIGdpdmUgZWxlbWVudHMgdW5pcXVlIHByZWZpeGVzIChlLmcuLCBcImE6dGFnXCIpLlxyXG4gIC8vIFN0YW5kYXJkIFhQYXRoIHdpdGggbmFtZXNwYWNlcyBjYW4gZmFpbCB0byBmaW5kIGVsZW1lbnRzLlxyXG4gIC8vIFRoZSBgbmFtZSgpYCBmdW5jdGlvbiByZXR1cm5zIHRoZSBmdWxsIGVsZW1lbnQgbmFtZSwgaW5jbHVkaW5nIHRoZSBwcmVmaXguXHJcbiAgLy8gVXNpbmcgXCIvKltuYW1lKCk9J2E6dGFnJ11cIiBlbnN1cmVzIHRoZSBYUGF0aCBtYXRjaGVzIHRoZSBlbGVtZW50IGNvcnJlY3RseS5cclxuICBjb25zdCB2YWxpZE5hbWVzcGFjZVRhZyA9IC9eW2EtekEtWl9dW1xcd1xcLS5dKjpbYS16QS1aX11bXFx3XFwtLl0qJC87XHJcblxyXG4gIC8vIFNwbGl0IHRoZSB0YWdOYW1lIGJ5ICcjJyAoSUQpIGFuZCAnLicgKGNsYXNzKSB0byBpc29sYXRlIHRoZSB0YWcgbmFtZSBwYXJ0XHJcbiAgY29uc3QgdGFnT25seSA9IHRhZ05hbWUuc3BsaXQoL1sjLl0vKVswXTtcclxuXHJcbiAgaWYgKHZhbGlkTmFtZXNwYWNlVGFnLnRlc3QodGFnT25seSkpIHtcclxuICAgIC8vIElmIGl0J3MgYSB2YWxpZCBuYW1lc3BhY2VkIHRhZywgd3JhcCB3aXRoIHRoZSBuYW1lKCkgZnVuY3Rpb25cclxuICAgIHJldHVybiB0YWdOYW1lLnJlcGxhY2UodGFnT25seSwgYCpbbmFtZSgpPVwiJHt0YWdPbmx5fVwiXWApO1xyXG4gIH0gZWxzZSB7XHJcbiAgICByZXR1cm4gdGFnTmFtZTtcclxuICB9XHJcbn07XHJcblxyXG53aW5kb3cucmV2ZXJ0VmlzaWJpbGl0aWVzID0gKCkgPT4ge1xyXG4gIGNvbnN0IGFsbEVsZW1lbnRzID0gZ2V0QWxsRWxlbWVudHNJbkFsbEZyYW1lcygpO1xyXG4gIGFsbEVsZW1lbnRzLmZvckVhY2goKGVsKSA9PiB7XHJcbiAgICBjb25zdCBlbGVtZW50ID0gZWwgYXMgSFRNTEVsZW1lbnQ7XHJcbiAgICBpZiAoZWxlbWVudC5nZXRBdHRyaWJ1dGUocmV3b3JrZFZpc2liaWxpdHlBdHRyaWJ1dGUpKSB7XHJcbiAgICAgIGVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9XHJcbiAgICAgICAgZWxlbWVudC5nZXRBdHRyaWJ1dGUocmV3b3JrZFZpc2liaWxpdHlBdHRyaWJ1dGUpIHx8IFwidHJ1ZVwiO1xyXG4gICAgfSBlbHNlIHtcclxuICAgICAgZWxlbWVudC5zdHlsZS5yZW1vdmVQcm9wZXJ0eShcInZpc2liaWxpdHlcIik7XHJcbiAgICB9XHJcbiAgfSk7XHJcbn07XHJcbiJdfQ==