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
function assign_role_to_element(el) {
    if (isInteractable(el)) {
        if (isTextInsertable(el)) {
            return "input";
        }
        else if (el.tagName.toLowerCase() == "a") {
            return "clickable";
        }
        else {
            return "clickable";
        }
    }
    else {
        return "text";
    }
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
            role: assign_role_to_element(el), // Default
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
                    role: "text",
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGFnX3V0aWxzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsidGFnX3V0aWxzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFxQkEsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDO0FBQ2pDLE1BQU0sb0JBQW9CLEdBQUcsaUJBQWlCLENBQUM7QUFDL0MsTUFBTSxlQUFlLEdBQUcsSUFBSSxTQUFTLEVBQUUsQ0FBQztBQUN4QyxNQUFNLDBCQUEwQixHQUFHLDZCQUE2QixDQUFDO0FBRWpFLE1BQU0sV0FBVyxHQUFHLENBQUMsRUFBZSxFQUFFLEVBQUU7SUFDdEMsTUFBTSxJQUFJLEdBQUcsRUFBRSxDQUFDLHFCQUFxQixFQUFFLENBQUM7SUFDeEMsTUFBTSxhQUFhLEdBQUcsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEVBQUUsQ0FBQyxDQUFDO0lBRWxELE1BQU0sUUFBUSxHQUNaLGFBQWEsQ0FBQyxVQUFVLEtBQUssUUFBUTtRQUNyQyxhQUFhLENBQUMsT0FBTyxLQUFLLE1BQU07UUFDaEMsRUFBRSxDQUFDLE1BQU07UUFDVCxDQUFDLEVBQUUsQ0FBQyxZQUFZLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBRS9ELE1BQU0sV0FBVyxHQUFHLGFBQWEsQ0FBQyxPQUFPLEtBQUssR0FBRyxDQUFDO0lBQ2xELHNGQUFzRjtJQUN0RixNQUFNLGFBQWEsR0FBRyxXQUFXLElBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLENBQUM7SUFDbkQsTUFBTSxpQkFBaUIsR0FBRyxhQUFhLENBQUMsT0FBTyxLQUFLLFVBQVUsQ0FBQztJQUMvRCxNQUFNLFVBQVUsR0FDZCxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLHFEQUFxRDtJQUN0SCxNQUFNLGVBQWUsR0FBRyxFQUFFLENB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Q0FBQyxDQUFDO0lBRXpDLElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO1FBQ25DLGdFQUFnRTtRQUNoRSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLGFBQWEsT0FBTyxJQUFJLENBQUMsQ0FBQztLQUMzRDtTQUFNO1FBQ0wsT0FBTyxPQUFPLENBQUM7S0FDaEI7QUFDSCxDQUFDLENBQUM7QUFFRixNQUFNLENBQUMsa0JBQWtCLEdBQUcsR0FBRyxFQUFFO0lBQy9CLE1BQU0sV0FBVyxHQUFHLHlCQUF5QixFQUFFLENBQUM7SUFDaEQsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFO1FBQ3pCLE1BQU0sT0FBTyxHQUFHLEVBQWlCLENBQUM7UUFDbEMsSUFBSSxPQUFPLENBQUMsWUFBWSxDQUFDLDBCQUEwQixDQUFDLEVBQUU7WUFDcEQsT0FBTyxDQUFDLEtBQUssQ0FBQyxVQUFVO2dCQUN0QixPQUFPLENBQUMsWUFBWSxDQUFDLDBCQUEwQixDQUFDLElBQUksTUFBTSxDQUFDO1NBQzlEO2FBQU07WUFDTCxPQUFPLENBQUMsS0FBSyxDQUFDLGNBQWMsQ0FBQyxZQUFZLENBQUMsQ0FBQztTQUM1QztJQUNILENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLy8gbm9pbnNwZWN0aW9uIEpTVW51c2VkR2xvYmFsU3ltYm9sc1xyXG5pbnRlcmZhY2UgV2luZG93IHtcclxuICAvLyBQbGF5d3JpZ2h0J3MgLmV2YWx1YXRlIG1ldGhvZCBydW5zIGphdmFzY3JpcHQgY29kZSBpbiBhbiBpc29sYXRlZCBzY29wZS5cclxuICAvLyBUaGlzIG1lYW5zIHRoYXQgc3Vic2VxdWVudCBjYWxscyB0byAuZXZhbHVhdGUgd2lsbCBub3QgaGF2ZSBhY2Nlc3MgdG8gdGhlIGZ1bmN0aW9ucyBkZWZpbmVkIGluIHRoaXMgZmlsZVxyXG4gIC8vIHNpbmNlIHRoZXkgd2lsbCBiZSBpbiBhbiBpbmFjY2Vzc2libGUgc2NvcGUuIFRvIGNpcmN1bXZlbnQgdGhpcywgd2UgYXR0YWNoIHRoZSBmb2xsb3dpbmcgbWV0aG9kcyB0byB0aGVcclxuICAvLyB3aW5kb3cgd2hpY2ggaXMgYWx3YXlzIGF2YWlsYWJsZSBnbG9iYWxseSB3aGVuIHJ1biBpbiBhIGJyb3dzZXIgZW52aXJvbm1lbnQuXHJcbiAgdGFnaWZ5V2VicGFnZTogKHRhZ0xlYWZUZXh0cz86IGJvb2xlYW4pID0+IHsgZGF0YTogeyBba2V5OiBudW1iZXJdOiBUYWdNZXRhZGF0YSB9IH07XHJcbiAgcmVtb3ZlVGFnczogKCkgPT4gdm9pZDtcclxuICBoaWRlTm9uVGFnRWxlbWVudHM6ICgpID0+IHZvaWQ7XHJcbiAgcmV2ZXJ0VmlzaWJpbGl0aWVzOiAoKSA9PiB2b2lkO1xyXG4gIGZpeE5hbWVzcGFjZXM6ICh0YWdOYW1lOiBzdHJpbmcpID0+IHN0cmluZztcclxufVxyXG5cclxuaW50ZXJmYWNlIFRhZ01ldGFkYXRhIHtcclxuICBhcmlhTGFiZWw/OiBzdHJpbmc7XHJcbiAgeHBhdGg6IHN0cmluZztcclxuICB0ZXh0Tm9kZUluZGV4PzogbnVtYmVyOyAvLyBVc2VkIGlmIHRoZSB0YWcgcmVmZXJzIHRvIHNwZWNpZmljIFRleHROb2RlIGVsZW1lbnRzIHdpdGhpbiB0aGUgdGFnZ2VkIEVsZW1lbnROb2RlXHJcbiAgbGFiZWw6IHN0cmluZztcclxuICByb2xlOiAndGV4dCcgfCAnaW5wdXQnIHwgJ2NsaWNrYWJsZSc7XHJcbn1cclxuXHJcbmNvbnN0IHRhcnNpZXJJZCA9IFwiX190YXJzaWVyX2lkXCI7XHJcbmNvbnN0IHRhcnNpZXJEYXRhQXR0cmlidXRlID0gXCJkYXRhLXRhcnNpZXItaWRcIjtcclxuY29uc3QgdGFyc2llclNlbGVjdG9yID0gYCMke3RhcnNpZXJJZH1gO1xyXG5jb25zdCByZXdvcmtkVmlzaWJpbGl0eUF0dHJpYnV0ZSA9IFwicmV3b3JrZC1vcmlnaW5hbC12aXNpYmlsaXR5XCI7XHJcblxyXG5jb25zdCBlbElzVmlzaWJsZSA9IChlbDogSFRNTEVsZW1lbnQpID0+IHtcclxuICBjb25zdCByZWN0ID0gZWwuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgY29uc3QgY29tcHV0ZWRTdHlsZSA9IHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKGVsKTtcclxuXHJcbiAgY29uc3QgaXNIaWRkZW4gPVxyXG4gICAgY29tcHV0ZWRTdHlsZS52aXNpYmlsaXR5ID09PSBcImhpZGRlblwiIHx8XHJcbiAgICBjb21wdXRlZFN0eWxlLmRpc3BsYXkgPT09IFwibm9uZVwiIHx8XHJcbiAgICBlbC5oaWRkZW4gfHxcclxuICAgIChlbC5oYXNBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiKSAmJiBlbC5nZXRBdHRyaWJ1dGUoXCJkaXNhYmxlZFwiKSk7XHJcblxyXG4gIGNvbnN0IGhhczBPcGFjaXR5ID0gY29tcHV0ZWRTdHlsZS5vcGFjaXR5ID09PSBcIjBcIjtcclxuICAvLyBPZnRlbiBpbnB1dCBlbGVtZW50cyB3aWxsIGhhdmUgMCBvcGFjaXR5IGJ1dCBzdGlsbCBoYXZlIHNvbWUgaW50ZXJhY3RhYmxlIGNvbXBvbmVudFxyXG4gIGNvbnN0IGlzVHJhbnNwYXJlbnQgPSBoYXMwT3BhY2l0eSAmJiAhaGFzTGFiZWwoZWwpO1xyXG4gIGNvbnN0IGlzRGlzcGxheUNvbnRlbnRzID0gY29tcHV0ZWRTdHlsZS5kaXNwbGF5ID09PSBcImNvbnRlbnRzXCI7XHJcbiAgY29uc3QgaXNaZXJvU2l6ZSA9XHJcbiAgICAocmVjdC53aWR0aCA9PT0gMCB8fCByZWN0LmhlaWdodCA9PT0gMCkgJiYgIWlzRGlzcGxheUNvbnRlbnRzOyAvLyBkaXNwbGF5OiBjb250ZW50cyBlbGVtZW50cyBoYXZlIDAgd2lkdGggYW5kIGhlaWdodFxyXG4gIGNvbnN0IGlzU2NyaXB0T3JTdHlsZSA9IGVsLnRhZ05hbWUgPT09IFwiU0NSSVBUXCIgfHwgZWwudGFnTmFtZSA9PT0gXCJTVFlMRVwiO1xyXG4gIHJldHVybiAhaXNIaWRkZW4gJiYgIWlzVHJhbnNwYXJlbnQgJiYgIWlzWmVyb1NpemUgJiYgIWlzU2NyaXB0T3JTdHlsZTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIGhhc0xhYmVsKGVsZW1lbnQ6IEhUTUxFbGVtZW50KTogYm9vbGVhbiB7XHJcbiAgY29uc3QgdGFnc1RoYXRDYW5IYXZlTGFiZWxzID0gW1wiaW5wdXRcIiwgXCJ0ZXh0YXJlYVwiLCBcInNlbGVjdFwiLCBcImJ1dHRvblwiXTtcclxuXHJcbiAgaWYgKCF0YWdzVGhhdENhbkhhdmVMYWJlbHMuaW5jbHVkZXMoZWxlbWVudC50YWdOYW1lLnRvTG93ZXJDYXNlKCkpKSB7XHJcbiAgICByZXR1cm4gZmFsc2U7XHJcbiAgfVxyXG5cclxuICBjb25zdCBlc2NhcGVkSWQgPSBDU1MuZXNjYXBlKGVsZW1lbnQuaWQpO1xyXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQucXVlcnlTZWxlY3RvcihgbGFiZWxbZm9yPVwiJHtlc2NhcGVkSWR9XCJdYCk7XHJcblxyXG4gIGlmIChsYWJlbCkge1xyXG4gICAgcmV0dXJuIHRydWU7XHJcbiAgfVxyXG5cclxuICAvLyBUaGUgbGFiZWwgbWF5IG5vdCBiZSBkaXJlY3RseSBhc3NvY2lhdGVkIHdpdGggdGhlIGVsZW1lbnQgYnV0IG1heSBiZSBhIHNpYmxpbmdcclxuICBjb25zdCBzaWJsaW5ncyA9IEFycmF5LmZyb20oZWxlbWVudC5wYXJlbnRFbGVtZW50Py5jaGlsZHJlbiB8fCBbXSk7XHJcbiAgZm9yIChsZXQgc2libGluZyBvZiBzaWJsaW5ncykge1xyXG4gICAgaWYgKHNpYmxpbmcudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09PSBcImxhYmVsXCIpIHtcclxuICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZmFsc2U7XHJcbn1cclxuXHJcbmNvbnN0IGlzVGFnZ2FibGVUZXh0Tm9kZSA9IChjaGlsZDogQ2hpbGROb2RlKSA9PiB7XHJcbiAgcmV0dXJuIGlzTm9uV2hpdGVTcGFjZVRleHROb2RlKGNoaWxkKSAmJiBpc1RleHROb2RlQVZhbGlkV29yZChjaGlsZCk7XHJcbn07XHJcblxyXG5jb25zdCBpc05vbldoaXRlU3BhY2VUZXh0Tm9kZSA9IChjaGlsZDogQ2hpbGROb2RlKSA9PiB7XHJcbiAgcmV0dXJuIChcclxuICAgIGNoaWxkLm5vZGVUeXBlID09PSBOb2RlLlRFWFRfTk9ERSAmJlxyXG4gICAgY2hpbGQudGV4dENvbnRlbnQgJiZcclxuICAgIGNoaWxkLnRleHRDb250ZW50LnRyaW0oKS5sZW5ndGggPiAwICYmXHJcbiAgICBjaGlsZC50ZXh0Q29udGVudC50cmltKCkgIT09IFwiXFx1MjAwQlwiXHJcbiAgKTtcclxufTtcclxuXHJcbmNvbnN0IGlzVGV4dE5vZGVBVmFsaWRXb3JkID0gKGNoaWxkOiBDaGlsZE5vZGUpID0+IHtcclxuICAvLyBXZSBkb24ndCB3YW50IHRvIGJlIHRhZ2dpbmcgc2VwYXJhdG9yIHN5bWJvbHMgbGlrZSAnfCcgb3IgJy8nIG9yICc+JyBldGNcclxuICBjb25zdCB0cmltbWVkV29yZCA9IGNoaWxkLnRleHRDb250ZW50Py50cmltKCk7XHJcbiAgcmV0dXJuIHRyaW1tZWRXb3JkICYmICh0cmltbWVkV29yZC5tYXRjaCgvXFx3LykgfHwgdHJpbW1lZFdvcmQubGVuZ3RoID4gMyk7IC8vIFJlZ2V4IG1hdGNoZXMgYW55IGNoYXJhY3RlciwgbnVtYmVyLCBvciBfXHJcbn07XHJcblxyXG5jb25zdCBpbnB1dHMgPSBbXCJhXCIsIFwiYnV0dG9uXCIsIFwidGV4dGFyZWFcIiwgXCJzZWxlY3RcIiwgXCJkZXRhaWxzXCIsIFwibGFiZWxcIl07XHJcbmNvbnN0IGlzSW50ZXJhY3RhYmxlID0gKGVsOiBIVE1MRWxlbWVudCkgPT4ge1xyXG4gIC8vIElmIGl0IGlzIGEgbGFiZWwgYnV0IGhhcyBhbiBpbnB1dCBjaGlsZCB0aGF0IGl0IGlzIGEgbGFiZWwgZm9yLCBzYXkgbm90IGludGVyYWN0YWJsZVxyXG4gIGlmIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwibGFiZWxcIiAmJiBlbC5xdWVyeVNlbGVjdG9yKFwiaW5wdXRcIikpIHtcclxuICAgIHJldHVybiBmYWxzZTtcclxuICB9XHJcblxyXG4gIHJldHVybiAoXHJcbiAgICBpbnB1dHMuaW5jbHVkZXMoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpKSB8fFxyXG4gICAgLy8gQHRzLWlnbm9yZVxyXG4gICAgKGVsLnRhZ05hbWUudG9Mb3dlckNhc2UoKSA9PT0gXCJpbnB1dFwiICYmIGVsLnR5cGUgIT09IFwiaGlkZGVuXCIpIHx8XHJcbiAgICBlbC5yb2xlID09PSBcImJ1dHRvblwiXHJcbiAgKTtcclxufTtcclxuXHJcbmNvbnN0IHRleHRfaW5wdXRfdHlwZXMgPSBbXHJcbiAgXCJ0ZXh0XCIsXHJcbiAgXCJwYXNzd29yZFwiLFxyXG4gIFwiZW1haWxcIixcclxuICBcInNlYXJjaFwiLFxyXG4gIFwidXJsXCIsXHJcbiAgXCJ0ZWxcIixcclxuICBcIm51bWJlclwiLFxyXG5dO1xyXG5jb25zdCBpc1RleHRJbnNlcnRhYmxlID0gKGVsOiBIVE1MRWxlbWVudCkgPT5cclxuICBlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwidGV4dGFyZWFcIiB8fFxyXG4gIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT09IFwiaW5wdXRcIiAmJlxyXG4gICAgdGV4dF9pbnB1dF90eXBlcy5pbmNsdWRlcygoZWwgYXMgSFRNTElucHV0RWxlbWVudCkudHlwZSkpO1xyXG5cclxuLy8gVGhlc2UgdGFncyBtYXkgbm90IGhhdmUgdGV4dCBidXQgY2FuIHN0aWxsIGJlIGludGVyYWN0YWJsZVxyXG5jb25zdCB0ZXh0TGVzc1RhZ1doaXRlTGlzdCA9IFtcImlucHV0XCIsIFwidGV4dGFyZWFcIiwgXCJzZWxlY3RcIiwgXCJidXR0b25cIiwgXCJhXCJdO1xyXG5cclxuY29uc3QgaXNUZXh0TGVzcyA9IChlbDogSFRNTEVsZW1lbnQpID0+IHtcclxuICBjb25zdCB0YWdOYW1lID0gZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpO1xyXG4gIGlmICh0ZXh0TGVzc1RhZ1doaXRlTGlzdC5pbmNsdWRlcyh0YWdOYW1lKSkgcmV0dXJuIGZhbHNlO1xyXG4gIGlmIChlbC5jaGlsZEVsZW1lbnRDb3VudCA+IDApIHJldHVybiBmYWxzZTtcclxuICBpZiAoXCJpbm5lclRleHRcIiBpbiBlbCAmJiBlbC5pbm5lclRleHQudHJpbSgpLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgLy8gbG9vayBmb3Igc3ZnIG9yIGltZyBpbiB0aGUgZWxlbWVudFxyXG4gICAgY29uc3Qgc3ZnID0gZWwucXVlcnlTZWxlY3RvcihcInN2Z1wiKTtcclxuICAgIGNvbnN0IGltZyA9IGVsLnF1ZXJ5U2VsZWN0b3IoXCJpbWdcIik7XHJcblxyXG4gICAgaWYgKHN2ZyB8fCBpbWcpIHJldHVybiBmYWxzZTtcclxuXHJcbiAgICByZXR1cm4gaXNFbGVtZW50SW5WaWV3cG9ydChlbCk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZmFsc2U7XHJcbn07XHJcblxyXG5mdW5jdGlvbiBpc0VsZW1lbnRJblZpZXdwb3J0KGVsOiBIVE1MRWxlbWVudCkge1xyXG4gIGNvbnN0IHJlY3QgPSBlbC5nZXRCb3VuZGluZ0NsaWVudFJlY3QoKTtcclxuXHJcbiAgY29uc3QgaXNMYXJnZXJUaGFuMXgxID0gcmVjdC53aWR0aCA+IDEgfHwgcmVjdC5oZWlnaHQgPiAxO1xyXG5cclxuICBsZXQgYm9keSA9IGRvY3VtZW50LmJvZHksXHJcbiAgICBodG1sID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50O1xyXG4gIGNvbnN0IGhlaWdodCA9IE1hdGgubWF4KFxyXG4gICAgYm9keS5zY3JvbGxIZWlnaHQsXHJcbiAgICBib2R5Lm9mZnNldEhlaWdodCxcclxuICAgIGh0bWwuY2xpZW50SGVpZ2h0LFxyXG4gICAgaHRtbC5zY3JvbGxIZWlnaHQsXHJcbiAgICBodG1sLm9mZnNldEhlaWdodCxcclxuICApO1xyXG4gIGNvbnN0IHdpZHRoID0gTWF0aC5tYXgoXHJcbiAgICBib2R5LnNjcm9sbFdpZHRoLFxyXG4gICAgYm9keS5vZmZzZXRXaWR0aCxcclxuICAgIGh0bWwuY2xpZW50V2lkdGgsXHJcbiAgICBodG1sLnNjcm9sbFdpZHRoLFxyXG4gICAgaHRtbC5vZmZzZXRXaWR0aCxcclxuICApO1xyXG5cclxuICByZXR1cm4gKFxyXG4gICAgaXNMYXJnZXJUaGFuMXgxICYmXHJcbiAgICByZWN0LnRvcCA+PSAwICYmXHJcbiAgICByZWN0LmxlZnQgPj0gMCAmJlxyXG4gICAgcmVjdC5ib3R0b20gPD0gaGVpZ2h0ICYmXHJcbiAgICByZWN0LnJpZ2h0IDw9IHdpZHRoXHJcbiAgKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0RWxlbWVudFhQYXRoKGVsZW1lbnQ6IEhUTUxFbGVtZW50IHwgbnVsbCkge1xyXG4gIGxldCBwYXRoX3BhcnRzID0gW107XHJcblxyXG4gIGxldCBpZnJhbWVfc3RyID0gXCJcIjtcclxuICBpZiAoZWxlbWVudCAmJiBlbGVtZW50Lm93bmVyRG9jdW1lbnQgIT09IHdpbmRvdy5kb2N1bWVudCkge1xyXG4gICAgLy8gYXNzZXJ0IGVsZW1lbnQuaWZyYW1lX2luZGV4ICE9PSB1bmRlZmluZWQsIFwiRWxlbWVudCBpcyBub3QgaW4gdGhlIG1haW4gZG9jdW1lbnQgYW5kIGRvZXMgbm90IGhhdmUgYW4gaWZyYW1lX2luZGV4IGF0dHJpYnV0ZVwiO1xyXG4gICAgaWZyYW1lX3N0ciA9IGBpZnJhbWVbJHtlbGVtZW50LmdldEF0dHJpYnV0ZShcImlmcmFtZV9pbmRleFwiKX1dYDtcclxuICB9XHJcblxyXG4gIHdoaWxlIChlbGVtZW50KSB7XHJcbiAgICBpZiAoIWVsZW1lbnQudGFnTmFtZSkge1xyXG4gICAgICBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnROb2RlIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICAgICAgY29udGludWU7XHJcbiAgICB9XHJcblxyXG4gICAgbGV0IHRhZ05hbWUgPSBlbGVtZW50LnRhZ05hbWUudG9Mb3dlckNhc2UoKTtcclxuXHJcbiAgICBsZXQgcHJlZml4ID0gd2luZG93LmZpeE5hbWVzcGFjZXModGFnTmFtZSk7XHJcblxyXG4gICAgbGV0IHNpYmxpbmdfaW5kZXggPSAxO1xyXG5cclxuICAgIGxldCBzaWJsaW5nID0gZWxlbWVudC5wcmV2aW91c0VsZW1lbnRTaWJsaW5nO1xyXG4gICAgd2hpbGUgKHNpYmxpbmcpIHtcclxuICAgICAgaWYgKHNpYmxpbmcudGFnTmFtZSA9PT0gZWxlbWVudC50YWdOYW1lICYmIHNpYmxpbmcuaWQgIT0gdGFyc2llcklkKSB7XHJcbiAgICAgICAgc2libGluZ19pbmRleCsrO1xyXG4gICAgICB9XHJcbiAgICAgIHNpYmxpbmcgPSBzaWJsaW5nLnByZXZpb3VzRWxlbWVudFNpYmxpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgLy8gQ2hlY2sgbmV4dCBzaWJsaW5ncyB0byBkZXRlcm1pbmUgaWYgaW5kZXggc2hvdWxkIGJlIGFkZGVkXHJcbiAgICBsZXQgbmV4dFNpYmxpbmcgPSBlbGVtZW50Lm5leHRFbGVtZW50U2libGluZztcclxuICAgIGxldCBzaG91bGRBZGRJbmRleCA9IGZhbHNlO1xyXG4gICAgd2hpbGUgKG5leHRTaWJsaW5nKSB7XHJcbiAgICAgIGlmIChuZXh0U2libGluZy50YWdOYW1lID09PSBlbGVtZW50LnRhZ05hbWUpIHtcclxuICAgICAgICBzaG91bGRBZGRJbmRleCA9IHRydWU7XHJcbiAgICAgICAgYnJlYWs7XHJcbiAgICAgIH1cclxuICAgICAgbmV4dFNpYmxpbmcgPSBuZXh0U2libGluZy5uZXh0RWxlbWVudFNpYmxpbmc7XHJcbiAgICB9XHJcblxyXG4gICAgaWYgKHNpYmxpbmdfaW5kZXggPiAxIHx8IHNob3VsZEFkZEluZGV4KSB7XHJcbiAgICAgIHByZWZpeCArPSBgWyR7c2libGluZ19pbmRleH1dYDtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoZWxlbWVudC5pZCkge1xyXG4gICAgICBwcmVmaXggKz0gYFtAaWQ9XCIke2VsZW1lbnQuaWR9XCJdYDtcclxuXHJcbiAgICAgIC8vIElmIHRoZSBpZCBpcyB1bmlxdWUgYW5kIHdlIGhhdmUgZW5vdWdoIHBhdGggcGFydHMsIHdlIGNhbiBzdG9wXHJcbiAgICAgIGlmIChwYXRoX3BhcnRzLmxlbmd0aCA+IDMpIHtcclxuICAgICAgICBwYXRoX3BhcnRzLnVuc2hpZnQocHJlZml4KTtcclxuICAgICAgICByZXR1cm4gXCIvL1wiICsgcGF0aF9wYXJ0cy5qb2luKFwiL1wiKTtcclxuICAgICAgfVxyXG4gICAgfSBlbHNlIGlmIChlbGVtZW50LmNsYXNzTmFtZSkge1xyXG4gICAgICBwcmVmaXggKz0gYFtAY2xhc3M9XCIke2VsZW1lbnQuY2xhc3NOYW1lfVwiXWA7XHJcbiAgICB9XHJcblxyXG4gICAgcGF0aF9wYXJ0cy51bnNoaWZ0KHByZWZpeCk7XHJcbiAgICBlbGVtZW50ID0gZWxlbWVudC5wYXJlbnROb2RlIGFzIEhUTUxFbGVtZW50IHwgbnVsbDtcclxuICB9XHJcbiAgcmV0dXJuIGlmcmFtZV9zdHIgKyBcIi8vXCIgKyBwYXRoX3BhcnRzLmpvaW4oXCIvXCIpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhc3NpZ25fcm9sZV90b19lbGVtZW50KGVsOiBIVE1MRWxlbWVudClcclxue1xyXG4gIGlmIChpc0ludGVyYWN0YWJsZShlbCkpIHtcclxuICAgIGlmIChpc1RleHRJbnNlcnRhYmxlKGVsKSkge1xyXG4gICAgICByZXR1cm4gXCJpbnB1dFwiO1xyXG4gICAgfSBlbHNlIGlmIChlbC50YWdOYW1lLnRvTG93ZXJDYXNlKCkgPT0gXCJhXCIpIHtcclxuICAgICAgcmV0dXJuIFwiY2xpY2thYmxlXCI7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICByZXR1cm4gXCJjbGlja2FibGVcIjtcclxuICAgIH1cclxuICB9IGVsc2Uge1xyXG4gICAgcmV0dXJuIFwidGV4dFwiO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gY3JlYXRlX3RhZ2dlZF9zcGFuKGlkTnVtOiBudW1iZXIsIGVsOiBIVE1MRWxlbWVudCkge1xyXG4gIGxldCBpZFN0cjogc3RyaW5nO1xyXG4gIGlmIChpc0ludGVyYWN0YWJsZShlbCkpIHtcclxuICAgIGlmIChpc1RleHRJbnNlcnRhYmxlKGVsKSkgaWRTdHIgPSBgWyMke2lkTnVtfV1gO1xyXG4gICAgZWxzZSBpZiAoZWwudGFnTmFtZS50b0xvd2VyQ2FzZSgpID09IFwiYVwiKSBpZFN0ciA9IGBbQCR7aWROdW19XWA7XHJcbiAgICBlbHNlIGlkU3RyID0gYFskJHtpZE51bX1dYDtcclxuICB9IGVsc2Uge1xyXG4gICAgaWRTdHIgPSBgWyR7aWROdW19XWA7XHJcbiAgfVxyXG5cclxuICBsZXQgaWRTcGFuID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInNwYW5cIik7XHJcbiAgaWRTcGFuLmlkID0gdGFyc2llcklkO1xyXG4gIGlkU3Bhbi5zdHlsZS5wb3NpdGlvbiA9IFwicmVsYXRpdmVcIjtcclxuICBpZFNwYW4uc3R5bGUuZGlzcGxheSA9IFwiaW5saW5lXCI7XHJcbiAgaWRTcGFuLnN0eWxlLmNvbG9yID0gXCJ3aGl0ZVwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5iYWNrZ3JvdW5kQ29sb3IgPSBcInJlZFwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5wYWRkaW5nID0gXCIxLjVweFwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5ib3JkZXJSYWRpdXMgPSBcIjNweFwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5mb250V2VpZ2h0ID0gXCJib2xkXCI7XHJcbiAgLy8gaWRTcGFuLnN0eWxlLmZvbnRTaXplID0gXCIxNXB4XCI7IC8vIFJlbW92aW5nIGJlY2F1c2UgT0NSIHdvbid0IHNlZSBzbWFsbCB0ZXh0IGFtb25nIGxhcmdlIGZvbnRcclxuICBpZFNwYW4uc3R5bGUuZm9udEZhbWlseSA9IFwiQXJpYWxcIjtcclxuICBpZFNwYW4uc3R5bGUubWFyZ2luID0gXCIxcHhcIjtcclxuICBpZFNwYW4uc3R5bGUubGluZUhlaWdodCA9IFwiMS4yNVwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5sZXR0ZXJTcGFjaW5nID0gXCIycHhcIjtcclxuICBpZFNwYW4uc3R5bGUuekluZGV4ID0gXCIyMTQwMDAwMDQ2XCI7XHJcbiAgaWRTcGFuLnN0eWxlLmNsaXAgPSBcImF1dG9cIjtcclxuICBpZFNwYW4uc3R5bGUuaGVpZ2h0ID0gXCJmaXQtY29udGVudFwiO1xyXG4gIGlkU3Bhbi5zdHlsZS53aWR0aCA9IFwiZml0LWNvbnRlbnRcIjtcclxuICBpZFNwYW4uc3R5bGUubWluSGVpZ2h0ID0gXCIxNXB4XCI7XHJcbiAgaWRTcGFuLnN0eWxlLm1pbldpZHRoID0gXCIyM3B4XCI7XHJcbiAgaWRTcGFuLnN0eWxlLm1heEhlaWdodCA9IFwidW5zZXRcIjtcclxuICBpZFNwYW4uc3R5bGUubWF4V2lkdGggPSBcInVuc2V0XCI7XHJcbiAgaWRTcGFuLnRleHRDb250ZW50ID0gaWRTdHI7XHJcbiAgaWRTcGFuLnN0eWxlLndlYmtpdFRleHRGaWxsQ29sb3IgPSBcIndoaXRlXCI7XHJcbiAgaWRTcGFuLnN0eWxlLnRleHRTaGFkb3cgPSBcIlwiO1xyXG4gIGlkU3Bhbi5zdHlsZS50ZXh0RGVjb3JhdGlvbiA9IFwibm9uZVwiO1xyXG4gIGlkU3Bhbi5zdHlsZS5sZXR0ZXJTcGFjaW5nID0gXCIwcHhcIjtcclxuXHJcbiAgaWRTcGFuLnNldEF0dHJpYnV0ZSh0YXJzaWVyRGF0YUF0dHJpYnV0ZSwgaWROdW0udG9TdHJpbmcoKSk7XHJcblxyXG4gIHJldHVybiBpZFNwYW47XHJcbn1cclxuXHJcbmNvbnN0IE1JTl9GT05UX1NJWkUgPSAxMTtcclxuY29uc3QgZW5zdXJlTWluaW11bVRhZ0ZvbnRTaXplcyA9ICgpID0+IHtcclxuICBjb25zdCB0YWdzID0gQXJyYXkuZnJvbShcclxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwodGFyc2llclNlbGVjdG9yKSxcclxuICApIGFzIEhUTUxFbGVtZW50W107XHJcbiAgdGFncy5mb3JFYWNoKCh0YWcpID0+IHtcclxuICAgIGxldCBmb250U2l6ZSA9IHBhcnNlRmxvYXQoXHJcbiAgICAgIHdpbmRvdy5nZXRDb21wdXRlZFN0eWxlKHRhZykuZm9udFNpemUuc3BsaXQoXCJweFwiKVswXSxcclxuICAgICk7XHJcbiAgICBpZiAoZm9udFNpemUgPCBNSU5fRk9OVF9TSVpFKSB7XHJcbiAgICAgIHRhZy5zdHlsZS5mb250U2l6ZSA9IGAke01JTl9GT05UX1NJWkV9cHhgO1xyXG4gICAgfVxyXG4gIH0pO1xyXG59O1xyXG5cclxud2luZG93LnRhZ2lmeVdlYnBhZ2UgPSAodGFnTGVhZlRleHRzID0gdHJ1ZSkgPT4ge1xyXG4gIHdpbmRvdy5yZW1vdmVUYWdzKCk7XHJcbiAgaGlkZU1hcEVsZW1lbnRzKCk7XHJcblxyXG4gIGNvbnN0IGFsbEVsZW1lbnRzID0gZ2V0QWxsRWxlbWVudHNJbkFsbEZyYW1lcygpO1xyXG4gIGNvbnN0IHJhd0VsZW1lbnRzVG9UYWcgPSBnZXRFbGVtZW50c1RvVGFnKGFsbEVsZW1lbnRzLCB0YWdMZWFmVGV4dHMpO1xyXG4gIGNvbnN0IGVsZW1lbnRzVG9UYWcgPSByZW1vdmVOZXN0ZWRUYWdzKHJhd0VsZW1lbnRzVG9UYWcpO1xyXG4gIGNvbnN0IGlkVG9UYWdNZXRhID0gaW5zZXJ0VGFncyhlbGVtZW50c1RvVGFnLCB0YWdMZWFmVGV4dHMpO1xyXG4gIHNocmlua0NvbGxpZGluZ1RhZ3MoKTtcclxuICBlbnN1cmVNaW5pbXVtVGFnRm9udFNpemVzKCk7XHJcblxyXG4gIHZhciByZXMgPSBPYmplY3QuZW50cmllcyhpZFRvVGFnTWV0YSkucmVkdWNlKFxyXG4gICAgKGFjYywgW2lkLCBtZXRhXSkgPT4ge1xyXG4gICAgICBhY2NbcGFyc2VJbnQoaWQpXSA9IG1ldGFcclxuICAgICAgcmV0dXJuIGFjYztcclxuICAgIH0sXHJcbiAgICB7fSBhcyB7IFtrZXk6IG51bWJlcl06IFRhZ01ldGFkYXRhIH0sXHJcbiAgKTtcclxuXHJcbiAgLy8gcmVzID0+IGFycmF5IG9mIG9iamVjdHNcclxuICB2YXIgYXJyYXkgPSBPYmplY3QudmFsdWVzKHJlcyk7XHJcbiAgcmV0dXJuIHsgZGF0YTogYXJyYXkgfTtcclxufTtcclxuXHJcbmZ1bmN0aW9uIGdldEFsbEVsZW1lbnRzSW5BbGxGcmFtZXMoKTogSFRNTEVsZW1lbnRbXSB7XHJcbiAgLy8gTWFpbiBwYWdlXHJcbiAgY29uc3QgYWxsRWxlbWVudHM6IEhUTUxFbGVtZW50W10gPSBBcnJheS5mcm9tKFxyXG4gICAgZG9jdW1lbnQuYm9keS5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKSxcclxuICApO1xyXG5cclxuICAvLyBBZGQgYWxsIGVsZW1lbnRzIGluIGlmcmFtZXNcclxuICAvLyBOT1RFOiBUaGlzIHN0aWxsIGRvZXNuJ3Qgd29yayBmb3IgYWxsIGlmcmFtZXNcclxuICBjb25zdCBpZnJhbWVzID0gZG9jdW1lbnQuZ2V0RWxlbWVudHNCeVRhZ05hbWUoXCJpZnJhbWVcIik7XHJcbiAgZm9yIChsZXQgaSA9IDA7IGkgPCBpZnJhbWVzLmxlbmd0aDsgaSsrKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBjb25zdCBmcmFtZSA9IGlmcmFtZXNbaV07XHJcbiAgICAgIGNvbnN0IGlmcmFtZURvY3VtZW50ID1cclxuICAgICAgICBmcmFtZS5jb250ZW50RG9jdW1lbnQgfHwgZnJhbWUuY29udGVudFdpbmRvdz8uZG9jdW1lbnQ7XHJcbiAgICAgIGlmICghaWZyYW1lRG9jdW1lbnQpIGNvbnRpbnVlO1xyXG5cclxuICAgICAgY29uc3QgaWZyYW1lRWxlbWVudHMgPSBBcnJheS5mcm9tKFxyXG4gICAgICAgIGlmcmFtZURvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIqXCIpLFxyXG4gICAgICApIGFzIEhUTUxFbGVtZW50W107XHJcbiAgICAgIGlmcmFtZUVsZW1lbnRzLmZvckVhY2goKGVsKSA9PlxyXG4gICAgICAgIGVsLnNldEF0dHJpYnV0ZShcImlmcmFtZV9pbmRleFwiLCBpLnRvU3RyaW5nKCkpLFxyXG4gICAgICApO1xyXG4gICAgICBhbGxFbGVtZW50cy5wdXNoKC4uLmlmcmFtZUVsZW1lbnRzKTtcclxuICAgIH0gY2F0Y2ggKGUpIHtcclxuICAgICAgY29uc29sZS5lcnJvcihcIkVycm9yIGFjY2Vzc2luZyBpZnJhbWUgY29udGVudDpcIiwgZSk7XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gYWxsRWxlbWVudHM7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEVsZW1lbnRzVG9UYWcoXHJcbiAgYWxsRWxlbWVudHM6IEhUTUxFbGVtZW50W10sXHJcbiAgdGFnTGVhZlRleHRzOiBib29sZWFuLFxyXG4pOiBIVE1MRWxlbWVudFtdIHtcclxuICBjb25zdCBlbGVtZW50c1RvVGFnOiBIVE1MRWxlbWVudFtdID0gW107XHJcblxyXG4gIGZvciAobGV0IGVsIG9mIGFsbEVsZW1lbnRzKSB7XHJcbiAgICBpZiAoaXNUZXh0TGVzcyhlbCkgfHwgIWVsSXNWaXNpYmxlKGVsKSkge1xyXG4gICAgICBjb250aW51ZTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoaXNJbnRlcmFjdGFibGUoZWwpKSB7XHJcbiAgICAgIGVsZW1lbnRzVG9UYWcucHVzaChlbCk7XHJcbiAgICB9IGVsc2UgaWYgKHRhZ0xlYWZUZXh0cykge1xyXG4gICAgICAvLyBBcHBlbmQgdGhlIHBhcmVudCB0YWcgYXMgaXQgbWF5IGhhdmUgbXVsdGlwbGUgaW5kaXZpZHVhbCBjaGlsZCBub2RlcyB3aXRoIHRleHRcclxuICAgICAgLy8gV2Ugd2lsbCB0YWcgdGhlbSBpbmRpdmlkdWFsbHkgbGF0ZXJcclxuICAgICAgaWYgKEFycmF5LmZyb20oZWwuY2hpbGROb2RlcykuZmlsdGVyKGlzVGFnZ2FibGVUZXh0Tm9kZSkubGVuZ3RoID49IDEpIHtcclxuICAgICAgICBlbGVtZW50c1RvVGFnLnB1c2goZWwpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gZWxlbWVudHNUb1RhZztcclxufVxyXG5cclxuZnVuY3Rpb24gcmVtb3ZlTmVzdGVkVGFncyhlbGVtZW50c1RvVGFnOiBIVE1MRWxlbWVudFtdKTogSFRNTEVsZW1lbnRbXSB7XHJcbiAgLy8gQW4gaW50ZXJhY3RhYmxlIGVsZW1lbnQgbWF5IGhhdmUgbXVsdGlwbGUgdGFnZ2VkIGVsZW1lbnRzIGluc2lkZVxyXG4gIC8vIE1vc3QgY29tbW9ubHksIHRoZSB0ZXh0IHdpbGwgYmUgdGFnZ2VkIGFsb25nc2lkZSB0aGUgaW50ZXJhY3RhYmxlIGVsZW1lbnRcclxuICAvLyBJbiB0aGlzIGNhc2UgdGhlcmUgaXMgb25seSBvbmUgY2hpbGQsIGFuZCB3ZSBzaG91bGQgcmVtb3ZlIHRoaXMgbmVzdGVkIHRhZ1xyXG4gIC8vIEluIG90aGVyIGNhc2VzLCB3ZSB3aWxsIGFsbG93IGZvciB0aGUgbmVzdGVkIHRhZ2dpbmdcclxuXHJcbiAgY29uc3QgcmVzID0gWy4uLmVsZW1lbnRzVG9UYWddO1xyXG4gIGVsZW1lbnRzVG9UYWcubWFwKChlbCkgPT4ge1xyXG4gICAgLy8gT25seSBpbnRlcmFjdGFibGUgZWxlbWVudHMgY2FuIGhhdmUgbmVzdGVkIHRhZ3NcclxuICAgIGlmIChpc0ludGVyYWN0YWJsZShlbCkpIHtcclxuICAgICAgY29uc3QgZWxlbWVudHNUb1JlbW92ZTogSFRNTEVsZW1lbnRbXSA9IFtdO1xyXG4gICAgICBlbC5xdWVyeVNlbGVjdG9yQWxsKFwiKlwiKS5mb3JFYWNoKChjaGlsZCkgPT4ge1xyXG4gICAgICAgIGNvbnN0IGluZGV4ID0gcmVzLmluZGV4T2YoY2hpbGQgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgIGlmIChpbmRleCA+IC0xKSB7XHJcbiAgICAgICAgICBlbGVtZW50c1RvUmVtb3ZlLnB1c2goY2hpbGQgYXMgSFRNTEVsZW1lbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfSk7XHJcblxyXG4gICAgICAvLyBPbmx5IHJlbW92ZSBuZXN0ZWQgdGFncyBpZiB0aGVyZSBpcyBvbmx5IGEgc2luZ2xlIGVsZW1lbnQgdG8gcmVtb3ZlXHJcbiAgICAgIGlmIChlbGVtZW50c1RvUmVtb3ZlLmxlbmd0aCA8PSAyKSB7XHJcbiAgICAgICAgZm9yIChsZXQgZWxlbWVudCBvZiBlbGVtZW50c1RvUmVtb3ZlKSB7XHJcbiAgICAgICAgICByZXMuc3BsaWNlKHJlcy5pbmRleE9mKGVsZW1lbnQpLCAxKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIHJlcztcclxufVxyXG5cclxuZnVuY3Rpb24gaW5zZXJ0VGFncyhcclxuICBlbGVtZW50c1RvVGFnOiBIVE1MRWxlbWVudFtdLFxyXG4gIHRhZ0xlYWZUZXh0czogYm9vbGVhbixcclxuKTogeyBba2V5OiBudW1iZXJdOiBUYWdNZXRhZGF0YSB9IHtcclxuICBmdW5jdGlvbiB0cmltVGV4dE5vZGVTdGFydChlbGVtZW50OiBIVE1MRWxlbWVudCkge1xyXG4gICAgLy8gVHJpbSBsZWFkaW5nIHdoaXRlc3BhY2UgZnJvbSB0aGUgZWxlbWVudCdzIHRleHQgY29udGVudFxyXG4gICAgLy8gVGhpcyB3YXksIHRoZSB0YWcgd2lsbCBiZSBpbmxpbmUgd2l0aCB0aGUgd29yZCBhbmQgbm90IHRleHR3cmFwXHJcbiAgICAvLyBFbGVtZW50IHRleHRcclxuICAgIGlmICghZWxlbWVudC5maXJzdENoaWxkIHx8IGVsZW1lbnQuZmlyc3RDaGlsZC5ub2RlVHlwZSAhPT0gTm9kZS5URVhUX05PREUpIHtcclxuICAgICAgcmV0dXJuO1xyXG4gICAgfVxyXG4gICAgY29uc3QgdGV4dE5vZGUgPSBlbGVtZW50LmZpcnN0Q2hpbGQgYXMgVGV4dDtcclxuICAgIHRleHROb2RlLnRleHRDb250ZW50ID0gdGV4dE5vZGUudGV4dENvbnRlbnQhLnRyaW1TdGFydCgpO1xyXG4gIH1cclxuXHJcbiAgZnVuY3Rpb24gZ2V0RWxlbWVudFRvSW5zZXJ0SW50byhcclxuICAgIGVsZW1lbnQ6IEhUTUxFbGVtZW50LFxyXG4gICAgaWRTcGFuOiBIVE1MU3BhbkVsZW1lbnQsXHJcbiAgKTogSFRNTEVsZW1lbnQge1xyXG4gICAgLy8gQW4gPGE+IHRhZyBtYXkganVzdCBiZSBhIHdyYXBwZXIgb3ZlciBtYW55IGVsZW1lbnRzLiAoVGhpbmsgYW4gPGE+IHdpdGggYSA8c3Bhbj4gYW5kIGFub3RoZXIgPHNwYW4+XHJcbiAgICAvLyBJZiB0aGVzZSBzdWIgY2hpbGRyZW4gYXJlIHRoZSBvbmx5IGNoaWxkcmVuLCB0aGV5IG1pZ2h0IGhhdmUgc3R5bGluZyB0aGF0IG1pcy1wb3NpdGlvbnMgdGhlIHRhZyB3ZSdyZSBhdHRlbXB0aW5nIHRvXHJcbiAgICAvLyBpbnNlcnQuIEJlY2F1c2Ugb2YgdGhpcywgd2Ugc2hvdWxkIGRyaWxsIGRvd24gYW1vbmcgdGhlc2Ugc2luZ2xlIGNoaWxkcmVuIHRvIGluc2VydCB0aGlzIHRhZ1xyXG5cclxuICAgIC8vIFNvbWUgZWxlbWVudHMgbWlnaHQganVzdCBiZSBlbXB0eS4gVGhleSBzaG91bGQgbm90IGNvdW50IGFzIFwiY2hpbGRyZW5cIiBhbmQgaWYgdGhlcmUgYXJlIGNhbmRpZGF0ZXMgdG8gZHJpbGwgZG93blxyXG4gICAgLy8gaW50byB3aGVuIHRoZXNlIGVtcHR5IGVsZW1lbnRzIGFyZSBjb25zaWRlcmVkLCB3ZSBzaG91bGQgZHJpbGxcclxuICAgIGNvbnN0IGNoaWxkcmVuVG9Db25zaWRlciA9IEFycmF5LmZyb20oZWxlbWVudC5jaGlsZE5vZGVzKS5maWx0ZXIoXHJcbiAgICAgIChjaGlsZCkgPT4ge1xyXG4gICAgICAgIGlmIChpc05vbldoaXRlU3BhY2VUZXh0Tm9kZShjaGlsZCkpIHtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH0gZWxzZSBpZiAoY2hpbGQubm9kZVR5cGUgPT09IE5vZGUuVEVYVF9OT0RFKSB7XHJcbiAgICAgICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICByZXR1cm4gIShcclxuICAgICAgICAgIGNoaWxkLm5vZGVUeXBlID09PSBOb2RlLkVMRU1FTlRfTk9ERSAmJlxyXG4gICAgICAgICAgKGlzVGV4dExlc3MoY2hpbGQgYXMgSFRNTEVsZW1lbnQpIHx8XHJcbiAgICAgICAgICAgICFlbElzVmlzaWJsZShjaGlsZCBhcyBIVE1MRWxlbWVudCkpXHJcbiAgICAgICAgKTtcclxuICAgICAgfSxcclxuICAgICk7XHJcblxyXG4gICAgaWYgKGNoaWxkcmVuVG9Db25zaWRlci5sZW5ndGggPT09IDEpIHtcclxuICAgICAgY29uc3QgY2hpbGQgPSBjaGlsZHJlblRvQ29uc2lkZXJbMF07XHJcbiAgICAgIC8vIEFsc28gY2hlY2sgaXRzIGEgc3BhbiBvciBQIHRhZ1xyXG4gICAgICBjb25zdCBlbGVtZW50c1RvRHJpbGxEb3duID0gW1xyXG4gICAgICAgIFwiZGl2XCIsXHJcbiAgICAgICAgXCJzcGFuXCIsXHJcbiAgICAgICAgXCJwXCIsXHJcbiAgICAgICAgXCJoMVwiLFxyXG4gICAgICAgIFwiaDJcIixcclxuICAgICAgICBcImgzXCIsXHJcbiAgICAgICAgXCJoNFwiLFxyXG4gICAgICAgIFwiaDVcIixcclxuICAgICAgICBcImg2XCIsXHJcbiAgICAgIF07XHJcbiAgICAgIGlmIChcclxuICAgICAgICBjaGlsZC5ub2RlVHlwZSA9PT0gTm9kZS5FTEVNRU5UX05PREUgJiZcclxuICAgICAgICBlbGVtZW50c1RvRHJpbGxEb3duLmluY2x1ZGVzKFxyXG4gICAgICAgICAgKGNoaWxkIGFzIEhUTUxFbGVtZW50KS50YWdOYW1lLnRvTG93ZXJDYXNlKCksXHJcbiAgICAgICAgKVxyXG4gICAgICApIHtcclxuICAgICAgICByZXR1cm4gZ2V0RWxlbWVudFRvSW5zZXJ0SW50byhjaGlsZCBhcyBIVE1MRWxlbWVudCwgaWRTcGFuKTtcclxuICAgICAgfVxyXG4gICAgfVxyXG5cclxuICAgIHRyaW1UZXh0Tm9kZVN0YXJ0KGVsZW1lbnQpO1xyXG5cclxuICAgIC8vIEJhc2UgY2FzZVxyXG4gICAgcmV0dXJuIGVsZW1lbnQ7XHJcbiAgfVxyXG5cclxuICBjb25zdCBpZFRvVGFnTWV0YWRhdGE6IHsgW2tleTogbnVtYmVyXTogVGFnTWV0YWRhdGEgfSA9IHt9O1xyXG4gIGxldCBpZE51bSA9IDA7XHJcblxyXG4gIGZvciAobGV0IGVsIG9mIGVsZW1lbnRzVG9UYWcpIHtcclxuICAgIGlkVG9UYWdNZXRhZGF0YVtpZE51bV0gPSB7XHJcbiAgICAgIHhwYXRoOiBnZXRFbGVtZW50WFBhdGgoZWwpLFxyXG4gICAgICBhcmlhTGFiZWw6IGVsLmdldEF0dHJpYnV0ZShcImFyaWEtbGFiZWxcIikgfHwgdW5kZWZpbmVkLFxyXG4gICAgICBsYWJlbDogaWROdW0udG9TdHJpbmcoKSxcclxuICAgICAgcm9sZTogYXNzaWduX3JvbGVfdG9fZWxlbWVudChlbCksIC8vIERlZmF1bHRcclxuICAgIH07XHJcblxyXG4gICAgaWYgKGlzSW50ZXJhY3RhYmxlKGVsKSkge1xyXG4gICAgICBjb25zdCBpZFNwYW4gPSBjcmVhdGVfdGFnZ2VkX3NwYW4oaWROdW0sIGVsKTtcclxuICAgICAgaWYgKGlzVGV4dEluc2VydGFibGUoZWwpICYmIGVsLnBhcmVudEVsZW1lbnQpIHtcclxuICAgICAgICBlbC5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShpZFNwYW4sIGVsKTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICBjb25zdCBpbnNlcnRpb25FbGVtZW50ID0gZ2V0RWxlbWVudFRvSW5zZXJ0SW50byhlbCwgaWRTcGFuKTtcclxuICAgICAgICBpbnNlcnRpb25FbGVtZW50LnByZXBlbmQoaWRTcGFuKTtcclxuICAgICAgICBhYnNvbHV0ZWx5UG9zaXRpb25UYWdJZk1pc2FsaWduZWQoaWRTcGFuLCBpbnNlcnRpb25FbGVtZW50KTtcclxuICAgICAgfVxyXG4gICAgICBpZE51bSsrO1xyXG4gICAgfSBlbHNlIGlmICh0YWdMZWFmVGV4dHMpIHtcclxuICAgICAgdHJpbVRleHROb2RlU3RhcnQoZWwpO1xyXG4gICAgICBjb25zdCB2YWxpZFRleHROb2RlcyA9IEFycmF5LmZyb20oZWwuY2hpbGROb2RlcykuZmlsdGVyKFxyXG4gICAgICAgIGlzVGFnZ2FibGVUZXh0Tm9kZSxcclxuICAgICAgKTtcclxuICAgICAgY29uc3QgYWxsVGV4dE5vZGVzID0gQXJyYXkuZnJvbShlbC5jaGlsZE5vZGVzKS5maWx0ZXIoXHJcbiAgICAgICAgKGNoaWxkKSA9PiBjaGlsZC5ub2RlVHlwZSA9PT0gTm9kZS5URVhUX05PREUsXHJcbiAgICAgICk7XHJcbiAgICAgIGZvciAobGV0IGNoaWxkIG9mIHZhbGlkVGV4dE5vZGVzKSB7XHJcbiAgICAgICAgY29uc3QgcGFyZW50WFBhdGggPSBnZXRFbGVtZW50WFBhdGgoZWwpO1xyXG4gICAgICAgIGNvbnN0IHRleHROb2RlSW5kZXggPSBhbGxUZXh0Tm9kZXMuaW5kZXhPZihjaGlsZCkgKyAxO1xyXG5cclxuICAgICAgICBpZFRvVGFnTWV0YWRhdGFbaWROdW1dID0ge1xyXG4gICAgICAgICAgeHBhdGg6IHBhcmVudFhQYXRoLFxyXG4gICAgICAgICAgdGV4dE5vZGVJbmRleDogdGV4dE5vZGVJbmRleCxcclxuICAgICAgICAgIGxhYmVsOiBpZE51bS50b1N0cmluZygpLFxyXG4gICAgICAgICAgYXJpYUxhYmVsOiBlbC5nZXRBdHRyaWJ1dGUoXCJhcmlhLWxhYmVsXCIpIHx8IHVuZGVmaW5lZCxcclxuICAgICAgICAgIHJvbGU6IFwidGV4dFwiLFxyXG4gICAgICAgIH07XHJcblxyXG4gICAgICAgIGNvbnN0IGlkU3BhbiA9IGNyZWF0ZV90YWdnZWRfc3BhbihpZE51bSwgZWwpO1xyXG4gICAgICAgIGVsLmluc2VydEJlZm9yZShpZFNwYW4sIGNoaWxkKTtcclxuICAgICAgICBpZE51bSsrO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG5cclxuICByZXR1cm4gaWRUb1RhZ01ldGFkYXRhO1xyXG59XHJcblxyXG5mdW5jdGlvbiBhYnNvbHV0ZWx5UG9zaXRpb25UYWdJZk1pc2FsaWduZWQoXHJcbiAgdGFnOiBIVE1MRWxlbWVudCxcclxuICByZWZlcmVuY2U6IEhUTUxFbGVtZW50LFxyXG4pIHtcclxuICAvKlxyXG4gIFNvbWUgdGFncyBkb24ndCBnZXQgZGlzcGxheWVkIG9uIHRoZSBwYWdlIHByb3Blcmx5XHJcbiAgVGhpcyBvY2N1cnMgaWYgdGhlIHBhcmVudCBlbGVtZW50IGNoaWxkcmVuIGFyZSBkaXNqb2ludGVkIGZyb20gdGhlIHBhcmVudFxyXG4gIEluIHRoaXMgY2FzZSwgd2UgYWJzb2x1dGVseSBwb3NpdGlvbiB0aGUgdGFnIHRvIHRoZSBwYXJlbnQgZWxlbWVudFxyXG4gICovXHJcblxyXG4gIGxldCB0YWdSZWN0ID0gdGFnLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gIGlmICghKHRhZ1JlY3Qud2lkdGggPT09IDAgfHwgdGFnUmVjdC5oZWlnaHQgPT09IDApKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG5cclxuICBjb25zdCBkaXN0YW5jZVRocmVzaG9sZCA9IDI1MDtcclxuXHJcbiAgLy8gQ2hlY2sgaWYgdGhlIGV4cGVjdGVkIHBvc2l0aW9uIGlzIG9mZi1zY3JlZW4gaG9yaXpvbnRhbGx5XHJcbiAgY29uc3QgZXhwZWN0ZWRUYWdQb3NpdGlvblJlY3QgPSByZWZlcmVuY2UuZ2V0Qm91bmRpbmdDbGllbnRSZWN0KCk7XHJcbiAgaWYgKFxyXG4gICAgZXhwZWN0ZWRUYWdQb3NpdGlvblJlY3QucmlnaHQgPCAwIHx8XHJcbiAgICBleHBlY3RlZFRhZ1Bvc2l0aW9uUmVjdC5sZWZ0ID5cclxuICAgICAgKHdpbmRvdy5pbm5lcldpZHRoIHx8IGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5jbGllbnRXaWR0aClcclxuICApIHtcclxuICAgIC8vIEV4cGVjdGVkIHBvc2l0aW9uIGlzIG9mZi1zY3JlZW4gaG9yaXpvbnRhbGx5LCByZW1vdmUgdGhlIHRhZ1xyXG4gICAgdGFnLnJlbW92ZSgpO1xyXG4gICAgcmV0dXJuOyAvLyBTa2lwIHRvIHRoZSBuZXh0IHRhZ1xyXG4gIH1cclxuXHJcbiAgY29uc3QgcmVmZXJlbmNlVG9wTGVmdCA9IHtcclxuICAgIHg6IGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0LmxlZnQsXHJcbiAgICB5OiBleHBlY3RlZFRhZ1Bvc2l0aW9uUmVjdC50b3AsXHJcbiAgfTtcclxuXHJcbiAgY29uc3QgdGFnQ2VudGVyID0ge1xyXG4gICAgeDogKHRhZ1JlY3QubGVmdCArIHRhZ1JlY3QucmlnaHQpIC8gMixcclxuICAgIHk6ICh0YWdSZWN0LnRvcCArIHRhZ1JlY3QuYm90dG9tKSAvIDIsXHJcbiAgfTtcclxuXHJcbiAgY29uc3QgZHggPSBNYXRoLmFicyhyZWZlcmVuY2VUb3BMZWZ0LnggLSB0YWdDZW50ZXIueCk7XHJcbiAgY29uc3QgZHkgPSBNYXRoLmFicyhyZWZlcmVuY2VUb3BMZWZ0LnkgLSB0YWdDZW50ZXIueSk7XHJcbiAgaWYgKGR4ID4gZGlzdGFuY2VUaHJlc2hvbGQgfHwgZHkgPiBkaXN0YW5jZVRocmVzaG9sZCB8fCAhZWxJc1Zpc2libGUodGFnKSkge1xyXG4gICAgdGFnLnN0eWxlLnBvc2l0aW9uID0gXCJhYnNvbHV0ZVwiO1xyXG5cclxuICAgIC8vIEVuc3VyZSB0aGUgdGFnIGlzIHBvc2l0aW9uZWQgd2l0aGluIHRoZSBzY3JlZW4gYm91bmRzXHJcbiAgICBsZXQgbGVmdFBvc2l0aW9uID0gTWF0aC5tYXgoXHJcbiAgICAgIDAsXHJcbiAgICAgIGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0LmxlZnQgLSAodGFnUmVjdC5yaWdodCArIDMgLSB0YWdSZWN0LmxlZnQpLFxyXG4gICAgKTtcclxuICAgIGxlZnRQb3NpdGlvbiA9IE1hdGgubWluKFxyXG4gICAgICBsZWZ0UG9zaXRpb24sXHJcbiAgICAgIHdpbmRvdy5pbm5lcldpZHRoIC0gKHRhZ1JlY3QucmlnaHQgLSB0YWdSZWN0LmxlZnQpLFxyXG4gICAgKTtcclxuICAgIGxldCB0b3BQb3NpdGlvbiA9IE1hdGgubWF4KDAsIGV4cGVjdGVkVGFnUG9zaXRpb25SZWN0LnRvcCArIDMpOyAvLyBBZGQgc29tZSB0b3AgYnVmZmVyIHRvIGNlbnRlciBhbGlnbiBiZXR0ZXJcclxuICAgIHRvcFBvc2l0aW9uID0gTWF0aC5taW4oXHJcbiAgICAgIHRvcFBvc2l0aW9uLFxyXG4gICAgICBNYXRoLm1heCh3aW5kb3cuaW5uZXJIZWlnaHQsIGRvY3VtZW50LmRvY3VtZW50RWxlbWVudC5zY3JvbGxIZWlnaHQpIC1cclxuICAgICAgICAodGFnUmVjdC5ib3R0b20gLSB0YWdSZWN0LnRvcCksXHJcbiAgICApO1xyXG5cclxuICAgIHRhZy5zdHlsZS5sZWZ0ID0gYCR7bGVmdFBvc2l0aW9ufXB4YDtcclxuICAgIHRhZy5zdHlsZS50b3AgPSBgJHt0b3BQb3NpdGlvbn1weGA7XHJcblxyXG4gICAgdGFnLnBhcmVudEVsZW1lbnQgJiYgdGFnLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGFnKTtcclxuICAgIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQodGFnKTtcclxuICB9XHJcbn1cclxuXHJcbmNvbnN0IHNocmlua0NvbGxpZGluZ1RhZ3MgPSAoKSA9PiB7XHJcbiAgY29uc3QgdGFncyA9IEFycmF5LmZyb20oXHJcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKHRhcnNpZXJTZWxlY3RvciksXHJcbiAgKSBhcyBIVE1MRWxlbWVudFtdO1xyXG4gIGZvciAobGV0IGkgPSAwOyBpIDwgdGFncy5sZW5ndGg7IGkrKykge1xyXG4gICAgY29uc3QgdGFnID0gdGFnc1tpXTtcclxuICAgIGxldCB0YWdSZWN0ID0gdGFnLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgbGV0IGZvbnRTaXplID0gcGFyc2VGbG9hdChcclxuICAgICAgd2luZG93LmdldENvbXB1dGVkU3R5bGUodGFnKS5mb250U2l6ZS5zcGxpdChcInB4XCIpWzBdLFxyXG4gICAgKTtcclxuXHJcbiAgICBmb3IgKGxldCBqID0gaSArIDE7IGogPCB0YWdzLmxlbmd0aDsgaisrKSB7XHJcbiAgICAgIGNvbnN0IG90aGVyVGFnID0gdGFnc1tqXTtcclxuICAgICAgbGV0IG90aGVyVGFnUmVjdCA9IG90aGVyVGFnLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICBsZXQgb3RoZXJGb250U2l6ZSA9IHBhcnNlRmxvYXQoXHJcbiAgICAgICAgd2luZG93LmdldENvbXB1dGVkU3R5bGUob3RoZXJUYWcpLmZvbnRTaXplLnNwbGl0KFwicHhcIilbMF0sXHJcbiAgICAgICk7XHJcblxyXG4gICAgICB3aGlsZSAoXHJcbiAgICAgICAgdGFnUmVjdC5sZWZ0IDwgb3RoZXJUYWdSZWN0LnJpZ2h0ICYmXHJcbiAgICAgICAgdGFnUmVjdC5yaWdodCA+IG90aGVyVGFnUmVjdC5sZWZ0ICYmXHJcbiAgICAgICAgdGFnUmVjdC50b3AgPCBvdGhlclRhZ1JlY3QuYm90dG9tICYmXHJcbiAgICAgICAgdGFnUmVjdC5ib3R0b20gPiBvdGhlclRhZ1JlY3QudG9wICYmXHJcbiAgICAgICAgZm9udFNpemUgPiBNSU5fRk9OVF9TSVpFICYmXHJcbiAgICAgICAgb3RoZXJGb250U2l6ZSA+IE1JTl9GT05UX1NJWkVcclxuICAgICAgKSB7XHJcbiAgICAgICAgZm9udFNpemUgLT0gMC41O1xyXG4gICAgICAgIG90aGVyRm9udFNpemUgLT0gMC41O1xyXG4gICAgICAgIHRhZy5zdHlsZS5mb250U2l6ZSA9IGAke2ZvbnRTaXplfXB4YDtcclxuICAgICAgICBvdGhlclRhZy5zdHlsZS5mb250U2l6ZSA9IGAke290aGVyRm9udFNpemV9cHhgO1xyXG5cclxuICAgICAgICB0YWdSZWN0ID0gdGFnLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICAgIG90aGVyVGFnUmVjdCA9IG90aGVyVGFnLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xyXG4gICAgICB9XHJcbiAgICB9XHJcbiAgfVxyXG59O1xyXG5cclxud2luZG93LnJlbW92ZVRhZ3MgPSAoKSA9PiB7XHJcbiAgY29uc3QgdGFncyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwodGFyc2llclNlbGVjdG9yKTtcclxuICB0YWdzLmZvckVhY2goKHRhZykgPT4gdGFnLnJlbW92ZSgpKTtcclxuICBzaG93TWFwRWxlbWVudHMoKTtcclxufTtcclxuXHJcbmNvbnN0IEdPT0dMRV9NQVBTX09QQUNJVFlfQ09OVFJPTCA9IFwiX19yZXdvcmtkX2dvb2dsZV9tYXBzX29wYWNpdHlcIjtcclxuXHJcbmNvbnN0IGhpZGVNYXBFbGVtZW50cyA9ICgpOiB2b2lkID0+IHtcclxuICAvLyBNYXBzIGhhdmUgbG90cyBvZiB0aW55IGJ1dHRvbnMgdGhhdCBuZWVkIHRvIGJlIHRhZ2dlZFxyXG4gIC8vIFRoZXkgYWxzbyBoYXZlIGEgbG90IG9mIHRpbnkgdGV4dCBhbmQgYXJlIGFubm95aW5nIHRvIGRlYWwgd2l0aCBmb3IgcmVuZGVyaW5nXHJcbiAgLy8gQWxzbyBhbnkgZWxlbWVudCB3aXRoIGFyaWEtbGFiZWw9XCJNYXBcIiBhcmlhLXJvbGVkZXNjcmlwdGlvbj1cIm1hcFwiXHJcbiAgY29uc3Qgc2VsZWN0b3JzID0gW1xyXG4gICAgJ2lmcmFtZVtzcmMqPVwiZ29vZ2xlLmNvbS9tYXBzXCJdJyxcclxuICAgICdpZnJhbWVbaWQqPVwiZ21hcF9jYW52YXNcIl0nLFxyXG4gICAgXCIubWFwbGlicmVnbC1tYXBcIixcclxuICAgIFwiLm1hcGJveGdsLW1hcFwiLFxyXG4gICAgXCIubGVhZmxldC1jb250YWluZXJcIixcclxuICAgICdpbWdbc3JjKj1cIm1hcHMuZ29vZ2xlYXBpcy5jb21cIl0nLFxyXG4gICAgJ1thcmlhLWxhYmVsPVwiTWFwXCJdJyxcclxuICAgIFwiLmNtcC1sb2NhdGlvbi1tYXBfX21hcFwiLFxyXG4gICAgJy5tYXAtdmlld1tkYXRhLXJvbGU9XCJtYXBWaWV3XCJdJyxcclxuICAgIFwiLmdvb2dsZV9NYXAtd3JhcHBlclwiLFxyXG4gICAgXCIuZ29vZ2xlX21hcC13cmFwcGVyXCIsXHJcbiAgICBcIi5nb29nbGVNYXAtd3JhcHBlclwiLFxyXG4gICAgXCIuZ29vZ2xlbWFwLXdyYXBwZXJcIixcclxuICAgIFwiLmxzLW1hcC1jYW52YXNcIixcclxuICAgIFwiLmdtYXBjbHVzdGVyXCIsXHJcbiAgICBcIiNnb29nbGVNYXBcIixcclxuICAgIFwiI2dvb2dsZU1hcHNcIixcclxuICAgIFwiI2dvb2dsZW1hcHNcIixcclxuICAgIFwiI2dvb2dsZW1hcFwiLFxyXG4gICAgXCIjZ29vZ2xlX21hcFwiLFxyXG4gICAgXCIjZ29vZ2xlX21hcHNcIixcclxuICAgIFwiI01hcElkXCIsXHJcbiAgICBcIi5nZW9sb2NhdGlvbi1tYXAtd3JhcHBlclwiLFxyXG4gICAgXCIubG9jYXRvck1hcFwiLFxyXG4gIF07XHJcblxyXG4gIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoc2VsZWN0b3JzLmpvaW4oXCIsIFwiKSkuZm9yRWFjaCgoZWxlbWVudCkgPT4ge1xyXG4gICAgY29uc3QgY3VycmVudE9wYWNpdHkgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShlbGVtZW50KS5vcGFjaXR5O1xyXG4gICAgLy8gU3RvcmUgY3VycmVudCBvcGFjaXR5XHJcbiAgICBlbGVtZW50LnNldEF0dHJpYnV0ZShcImRhdGEtb3JpZ2luYWwtb3BhY2l0eVwiLCBjdXJyZW50T3BhY2l0eSk7XHJcblxyXG4gICAgKGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLm9wYWNpdHkgPSBcIjBcIjtcclxuICB9KTtcclxufTtcclxuXHJcbmNvbnN0IHNob3dNYXBFbGVtZW50cyA9ICgpID0+IHtcclxuICBjb25zdCBlbGVtZW50cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXHJcbiAgICBgWyR7R09PR0xFX01BUFNfT1BBQ0lUWV9DT05UUk9MfV1gLFxyXG4gICk7XHJcbiAgZWxlbWVudHMuZm9yRWFjaCgoZWxlbWVudCkgPT4ge1xyXG4gICAgKGVsZW1lbnQgYXMgSFRNTEVsZW1lbnQpLnN0eWxlLm9wYWNpdHkgPVxyXG4gICAgICBlbGVtZW50LmdldEF0dHJpYnV0ZShcImRhdGEtb3JpZ2luYWwtb3BhY2l0eVwiKSB8fCBcIjFcIjtcclxuICB9KTtcclxufTtcclxuXHJcbndpbmRvdy5oaWRlTm9uVGFnRWxlbWVudHMgPSAoKSA9PiB7XHJcbiAgY29uc3QgYWxsRWxlbWVudHMgPSBnZXRBbGxFbGVtZW50c0luQWxsRnJhbWVzKCk7XHJcbiAgYWxsRWxlbWVudHMuZm9yRWFjaCgoZWwpID0+IHtcclxuICAgIGNvbnN0IGVsZW1lbnQgPSBlbCBhcyBIVE1MRWxlbWVudDtcclxuXHJcbiAgICBpZiAoZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5KSB7XHJcbiAgICAgIGVsZW1lbnQuc2V0QXR0cmlidXRlKFxyXG4gICAgICAgIHJld29ya2RWaXNpYmlsaXR5QXR0cmlidXRlLFxyXG4gICAgICAgIGVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSxcclxuICAgICAgKTtcclxuICAgIH1cclxuXHJcbiAgICBpZiAoIWVsZW1lbnQuaWQuc3RhcnRzV2l0aCh0YXJzaWVySWQpKSB7XHJcbiAgICAgIGVsZW1lbnQuc3R5bGUudmlzaWJpbGl0eSA9IFwiaGlkZGVuXCI7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBlbGVtZW50LnN0eWxlLnZpc2liaWxpdHkgPSBcInZpc2libGVcIjtcclxuICAgIH1cclxuICB9KTtcclxufTtcclxuXHJcbndpbmRvdy5maXhOYW1lc3BhY2VzID0gKHRhZ05hbWU6IHN0cmluZyk6IHN0cmluZyA9PiB7XHJcbiAgLy8gTmFtZXNwYWNlcyBpbiBYTUwgZ2l2ZSBlbGVtZW50cyB1bmlxdWUgcHJlZml4ZXMgKGUuZy4sIFwiYTp0YWdcIikuXHJcbiAgLy8gU3RhbmRhcmQgWFBhdGggd2l0aCBuYW1lc3BhY2VzIGNhbiBmYWlsIHRvIGZpbmQgZWxlbWVudHMuXHJcbiAgLy8gVGhlIGBuYW1lKClgIGZ1bmN0aW9uIHJldHVybnMgdGhlIGZ1bGwgZWxlbWVudCBuYW1lLCBpbmNsdWRpbmcgdGhlIHByZWZpeC5cclxuICAvLyBVc2luZyBcIi8qW25hbWUoKT0nYTp0YWcnXVwiIGVuc3VyZXMgdGhlIFhQYXRoIG1hdGNoZXMgdGhlIGVsZW1lbnQgY29ycmVjdGx5LlxyXG4gIGNvbnN0IHZhbGlkTmFtZXNwYWNlVGFnID0gL15bYS16QS1aX11bXFx3XFwtLl0qOlthLXpBLVpfXVtcXHdcXC0uXSokLztcclxuXHJcbiAgLy8gU3BsaXQgdGhlIHRhZ05hbWUgYnkgJyMnIChJRCkgYW5kICcuJyAoY2xhc3MpIHRvIGlzb2xhdGUgdGhlIHRhZyBuYW1lIHBhcnRcclxuICBjb25zdCB0YWdPbmx5ID0gdGFnTmFtZS5zcGxpdCgvWyMuXS8pWzBdO1xyXG5cclxuICBpZiAodmFsaWROYW1lc3BhY2VUYWcudGVzdCh0YWdPbmx5KSkge1xyXG4gICAgLy8gSWYgaXQncyBhIHZhbGlkIG5hbWVzcGFjZWQgdGFnLCB3cmFwIHdpdGggdGhlIG5hbWUoKSBmdW5jdGlvblxyXG4gICAgcmV0dXJuIHRhZ05hbWUucmVwbGFjZSh0YWdPbmx5LCBgKltuYW1lKCk9XCIke3RhZ09ubHl9XCJdYCk7XHJcbiAgfSBlbHNlIHtcclxuICAgIHJldHVybiB0YWdOYW1lO1xyXG4gIH1cclxufTtcclxuXHJcbndpbmRvdy5yZXZlcnRWaXNpYmlsaXRpZXMgPSAoKSA9PiB7XHJcbiAgY29uc3QgYWxsRWxlbWVudHMgPSBnZXRBbGxFbGVtZW50c0luQWxsRnJhbWVzKCk7XHJcbiAgYWxsRWxlbWVudHMuZm9yRWFjaCgoZWwpID0+IHtcclxuICAgIGNvbnN0IGVsZW1lbnQgPSBlbCBhcyBIVE1MRWxlbWVudDtcclxuICAgIGlmIChlbGVtZW50LmdldEF0dHJpYnV0ZShyZXdvcmtkVmlzaWJpbGl0eUF0dHJpYnV0ZSkpIHtcclxuICAgICAgZWxlbWVudC5zdHlsZS52aXNpYmlsaXR5ID1cclxuICAgICAgICBlbGVtZW50LmdldEF0dHJpYnV0ZShyZXdvcmtkVmlzaWJpbGl0eUF0dHJpYnV0ZSkgfHwgXCJ0cnVlXCI7XHJcbiAgICB9IGVsc2Uge1xyXG4gICAgICBlbGVtZW50LnN0eWxlLnJlbW92ZVByb3BlcnR5KFwidmlzaWJpbGl0eVwiKTtcclxuICAgIH1cclxuICB9KTtcclxufTtcclxuIl19