// ==UserScript==
// @name         Pollinations.ai Enhancer
// @namespace    https://greasyfork.org/en/users/1462897-fisventurous
// @version      1.9.3
// @description  Enhanced markdown formatting for pollinations.ai with better readability, and smoother viewing
// @author       fisven
// @match        *://*.pollinations.ai/*
// @connect      *
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        unsafeWindow
// @run-at       document-start
// @downloadURL  https://github.com/fisventurous/pollinationsai-enhancer/raw/main/pln-enhancer.js
// @updateURL    https://github.com/fisventurous/pollinationsai-enhancer/raw/main/pln-enhancer.js
// @license MIT
// ==/UserScript==

(function() {
    'use strict';

    const THEME_KEY = 'pollinations_enhancer_theme';
    const FONT_SIZE_KEY = 'pollinations_enhancer_fontsize';

    let observer = null;

    // wait for page load or run immediately
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        console.log("Pollinations Enhancer v1.9.2 Initialising...");
        addStyles();
        applyTheme();
        applyFontSize();

        const pageType = detectPageType();
        setupLinkPreviews();

        if (pageType.isText) enhanceTextPage();
        else if (pageType.isImage) enhanceImagePage();
        else if (pageType.isAudio) enhanceAudioPage();
        else createCommonButtons(extractUrlParameters(), 'unknown'); // fallback for unknown

        if (pageType.isText) {
            updateThemeToggleButton(document.body.classList.contains('theme-dark'));
        }

        startObserver(pageType);
    }

    function detectPageType() {
        const url = window.location.href.toLowerCase();
        const urlParams = new URLSearchParams(window.location.search);

        let isImage = false;
        let isAudio = false;
        let isText = false;

        // check URL first
        if (url.includes('image.pollinations.ai') || url.includes('/image/')) {
            isImage = true;
        } else if (url.includes('audio') || url.match(/\.(mp3|wav|ogg|m4a)(\?|$)/i)) {
            isAudio = true;
        } else if (url.includes('text.pollinations.ai')) {
            isText = true;
        }

        // check URL params if type unknown
        if (!isImage && !isAudio && !isText) {
            const model = urlParams.get('model') || '';
            const hasVoice = urlParams.has('voice');

            if (model.includes('audio') || hasVoice) {
                isAudio = true;
            } else if (model.includes('image')) {
                isImage = true;
            }
        }

        // check page content as a last resort
        if (!isImage && !isAudio && !isText) {
            if (document.querySelector('img:not([width="16"][height="16"])')) {
                isImage = true; // found a significant image
            } else if (document.querySelector('audio, video, [type*="audio"]')) {
                isAudio = true; // found audio/video elements
            } else {
                isText = true; // assume text otherwise
            }
        }

        return { isText, isImage, isAudio };
    }

    function startObserver(pageType) {
        if (observer) observer.disconnect();

        observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length) {
                    // try re-enhancing if media loads dynamically
                    if (pageType.isImage && !document.getElementById('save-image-btn')) {
                        const newImages = Array.from(mutation.addedNodes)
                            .filter(node => node.tagName === 'IMG' || (node.querySelectorAll && node.querySelectorAll('img').length));
                        if (newImages.length) setTimeout(enhanceImagePage, 100);
                    }

                    if (pageType.isAudio && !document.getElementById('save-audio-btn')) {
                        const newAudio = Array.from(mutation.addedNodes)
                            .filter(node =>
                                node.tagName === 'AUDIO' ||
                                node.tagName === 'VIDEO' ||
                                (node.querySelectorAll && (
                                    node.querySelectorAll('audio').length ||
                                    node.querySelectorAll('video').length ||
                                    node.querySelectorAll('source[type*="audio"]').length
                                ))
                            );
                        if (newAudio.length) setTimeout(enhanceAudioPage, 100);
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    function applyTheme() {
        const savedTheme = GM_getValue(THEME_KEY, 'theme-dark'); // default dark
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(savedTheme);
    }

    function toggleTheme() {
        const isDark = document.body.classList.contains('theme-dark');
        const newTheme = isDark ? 'theme-light' : 'theme-dark';
        document.body.classList.remove('theme-dark', 'theme-light');
        document.body.classList.add(newTheme);
        GM_setValue(THEME_KEY, newTheme); // save preference
        updateThemeToggleButton(newTheme === 'theme-dark');
    }

    function updateThemeToggleButton(isDark) {
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) {
            // sun icon for dark theme, moon for light
            btn.innerHTML = isDark
                ? '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"></path></svg>'
                : '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>';
        }
    }

    function setupLinkPreviews() {
        const preview = document.createElement('div');
        preview.className = 'preview';
        document.body.appendChild(preview);
        let showTimeout = null, hideTimeout = null, currentLink = null;

        document.body.addEventListener('mouseover', (e) => {
            const link = e.target.closest('a');
            if (link?.href) { // check for link and href
                clearTimeout(hideTimeout);
                if (currentLink !== link) {
                    currentLink = link;
                    clearTimeout(showTimeout);
                    showTimeout = setTimeout(() => showPreview(link, preview), 200); // slight delay
                }
            }
        });

        document.body.addEventListener('mouseout', (e) => {
            if (e.target.closest('a')) {
                clearTimeout(showTimeout);
                hideTimeout = setTimeout(() => {
                    preview.style.opacity = '0';
                    setTimeout(() => {
                        preview.style.display = 'none';
                        currentLink = null;
                    }, 150); // wait for fade out
                }, 200); // delay before hiding
            }
        });

        // keep preview open if mouse moves onto it
        preview.addEventListener('mouseenter', () => clearTimeout(hideTimeout));
        preview.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                preview.style.opacity = '0';
                setTimeout(() => {
                    preview.style.display = 'none';
                    currentLink = null;
                }, 150);
            }, 200);
        });
    }

    function showPreview(link, preview) {
        try {
            const url = link.href;
            const rect = link.getBoundingClientRect();
            let sourceName = 'Source';
            let faviconUrl = '';

            try {
                const urlObj = new URL(url);
                sourceName = urlObj.hostname.replace(/^www\./, '');
                faviconUrl = `https://www.google.com/s2/favicons?domain=${urlObj.hostname}&sz=64`;
            } catch (err) { /* ignore invalid urls */ }

            let contentHTML = link.textContent?.trim() || url;
            if (link.closest('pre, code')) {
                contentHTML = `<code class="inline-code">${contentHTML}</code>`; // preserve code styling
            }

            const faviconHTML = faviconUrl
                ? `<img src="${faviconUrl}" alt="" onerror="this.style.display='none'; this.parentElement.textContent='${sourceName.charAt(0).toUpperCase()}';" />`
                : sourceName.charAt(0).toUpperCase();

            preview.innerHTML = `
                <div class="preview-header">
                    <div class="preview-icon">${faviconHTML}</div>
                    <div>${sourceName}</div>
                </div>
                <div class="preview-content">${contentHTML}</div>
                <div class="preview-url">${url}</div>
            `;

            preview.style.opacity = 0;
            preview.style.display = 'block';

            // position calculation needs to happen after display:block
            requestAnimationFrame(() => {
                const previewRect = preview.getBoundingClientRect();
                const winWidth = window.innerWidth;
                const winHeight = window.innerHeight;
                let top = rect.bottom + window.scrollY + 5;
                let left = rect.left + window.scrollX;

                // adjust position to stay within viewport
                if (left + previewRect.width > winWidth - 10) left = winWidth - previewRect.width - 10;
                if (left < 10) left = 10;
                if (top + previewRect.height > winHeight + window.scrollY - 10) top = rect.top + window.scrollY - previewRect.height - 5;
                if (top < window.scrollY + 10) top = window.scrollY + 10;

                preview.style.top = `${top}px`;
                preview.style.left = `${left}px`;
                preview.classList.add('active');
                preview.style.opacity = 1;
            });
        } catch (e) {
            console.error("Pollinations Enhancer: Error showing preview", e);
            preview.classList.remove('active');
            preview.style.display = 'none';
        }
    }

    function enhanceTextPage() {
        document.body.classList.add('text-enhanced');
        const params = extractUrlParameters();
        let contentContainer = null;
        let originalContent = "";

        try {
            // find the main content area
            contentContainer = document.querySelector(
                'main:not(:empty), article:not(:empty), .content:not(:empty), #content:not(:empty), .main-content:not(:empty), .post-content:not(:empty)'
            );

            // handle pages that might just be a single <pre> tag
            if (!contentContainer && document.body.children.length === 1 && document.body.firstElementChild?.tagName === 'PRE') {
                contentContainer = document.body.firstElementChild;
            }

            // if no container found, wrap bare text nodes (risky but sometimes needed)
            if (!contentContainer && (document.body.innerText || document.body.textContent || '').trim().length > 50) {
                console.log("Pollinations Enhancer: Wrapping bare text content.");
                contentContainer = document.createElement('div');
                contentContainer.className = 'content-container-generated'; // mark as generated
                // move body nodes into the container, careful not to move our script/buttons
                while (document.body.firstChild &&
                       (!document.body.firstChild.matches ||
                        !document.body.firstChild.matches('#pollinations-enhancer-buttons, .preview, script, style'))) {
                    contentContainer.appendChild(document.body.firstChild);
                }
                document.body.appendChild(contentContainer);
            }

            if (contentContainer) {
                contentContainer.classList.add('content-container');
                if (contentContainer.tagName !== 'PRE') {
                    // get original text *before* markdown processing
                    originalContent = contentContainer.innerText || contentContainer.textContent || '';
                    processMarkdown(contentContainer);
                } else {
                    originalContent = contentContainer.textContent || ''; // content is already plain text
                }
            } else {
                 console.warn("Pollinations Enhancer: Could not find a suitable content container.");
            }
        } catch (error) {
            console.error("Pollinations Enhancer: Error enhancing text page:", error);
        }

        createCommonButtons(params, 'text', contentContainer, originalContent);
    }

    function processMarkdown(container) {
        if (!container) return;

        // basic cleanup first
        container.innerHTML = container.innerHTML
            .replace(/<span class="[^"]*">/g, '') // remove potentially interfering spans
            .replace(/<\/span>/g, '');

        const codeBlocks = [];
        let codeBlockCount = 0;

        // isolate code blocks first to prevent markdown processing inside them
        container.innerHTML = container.innerHTML.replace(/```(\w*)\n([\s\S]*?)```/g, (match, lang, code) => {
            const placeholder = `<!--CODEBLOCK_${codeBlockCount}-->`;
            codeBlocks.push({
                placeholder,
                language: lang || 'text',
                code: code.replace(/`/g, '`') // escape backticks inside code
            });
            codeBlockCount++;
            return placeholder;
        });

        const originalHtmlWithPlaceholders = container.innerHTML;
        const textContentForProcessing = container.textContent || '';

        // process blockquotes on the text content
        let processedHtml = processBlockquotes(textContentForProcessing);

        // restore code block placeholders if blockquotes were processed
        if (processedHtml !== textContentForProcessing) {
             processedHtml = restoreCodeBlocks(processedHtml, originalHtmlWithPlaceholders);
        } else {
            processedHtml = originalHtmlWithPlaceholders; // use original if no blockquotes found
        }

        // now apply other markdown rules to the potentially modified html
        processedHtml = processedHtml
            .replace(/^(#{1,6})\s+(.+)$/gm, (match, hashes, content) => `<h${hashes.length}>${content}</h${hashes.length}>`) // Headers
            .replace(/^---+$/gm, '<hr class="markdown-hr">') // Horizontal rule
            .replace(/\*\*(.*?)\*\*|__(.*?)__/g, '<strong>$1$2</strong>') // Bold
            .replace(/\*(.*?)\*|_(.*?)_/g, '<em>$1$2</em>') // Italic
            .replace(/~~(.*?)~~/g, '<del>$1</del>') // Strikethrough
            .replace(/\[([^\]]+?)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>') // Links
            .replace(/`([^`]+?)`/g, '<code class="inline-code">$1</code>'); // Inline code

        // process lists after other formatting
        processedHtml = processLists(processedHtml);

        // put the processed html back into the container
        container.innerHTML = processedHtml;

        // restore the actual code block content
        codeBlocks.forEach(block => {
            const codeHtml = `
                <pre class="code-block-container">
                    <div class="code-header">
                        <span class="code-language">${block.language}</span>
                        <button class="code-copy-btn" title="Copy code">Copy</button>
                    </div>
                    <code class="language-${block.language}">${block.code}</code>
                </pre>`;
            container.innerHTML = container.innerHTML.replace(block.placeholder, codeHtml);
        });

        // add listeners to copy buttons inside code blocks
        container.querySelectorAll('.code-copy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const codeElement = btn.closest('.code-block-container')?.querySelector('code');
                if (codeElement) {
                    navigator.clipboard.writeText(codeElement.textContent || '').then(() => {
                        const originalText = btn.textContent;
                        btn.textContent = 'Copied!';
                        setTimeout(() => { btn.textContent = originalText; }, 1500);
                    }).catch(err => console.error('Failed to copy code:', err));
                }
            });
        });
    }

    function processBlockquotes(text) {
        const lines = text.split('\n');
        let result = [];
        let inMultiBlockquote = false;
        let blockquoteContent = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();

            if (trimmedLine.startsWith('>>>')) {
                // start multi-line blockquote
                if (inMultiBlockquote) { // close previous one if any
                    result.push(`<blockquote class="blockquote-multi">${blockquoteContent.join(' ')}</blockquote>`);
                }
                inMultiBlockquote = true;
                const initial = trimmedLine.substring(3).trim();
                blockquoteContent = initial ? [initial] : [];
            } else if (inMultiBlockquote) {
                // continue or end multi-line blockquote
                if (trimmedLine === '') { // end on empty line
                    result.push(`<blockquote class="blockquote-multi">${blockquoteContent.join(' ')}</blockquote>`);
                    result.push(''); // keep the empty line separator
                    inMultiBlockquote = false;
                    blockquoteContent = [];
                } else {
                    blockquoteContent.push(trimmedLine);
                }
            } else if (trimmedLine.startsWith('> ')) {
                // single line blockquote
                result.push(`<blockquote class="blockquote-single">${trimmedLine.substring(2)}</blockquote>`);
            } else {
                // regular line
                result.push(line);
            }
        }

        // close any open multi-line quote at the end of the text
        if (inMultiBlockquote) {
            result.push(`<blockquote class="blockquote-multi">${blockquoteContent.join(' ')}</blockquote>`);
        }

        return result.join('\n');
    }

    function restoreCodeBlocks(processedHtml, originalHtmlWithPlaceholders) {
        // find all placeholders in the original html
        const placeholders = originalHtmlWithPlaceholders.match(/<!--CODEBLOCK_\d+-->/g) || [];
        if (placeholders.length === 0) return processedHtml;

        let currentHtml = processedHtml;
        // replace placeholder markers in the processed text with the original placeholders
        // this is tricky because blockquote processing might have altered line structure
        // simple strategy: replace markers sequentially
        let placeholderIndex = 0;
        currentHtml = currentHtml.replace(/<!--CODEBLOCK_\d+-->/g, () => {
            if (placeholderIndex < placeholders.length) {
                return placeholders[placeholderIndex++];
            }
            return ''; // should not happen if counts match
        });

        // if counts didn't match, try injecting remaining placeholders (less ideal)
        while(placeholderIndex < placeholders.length) {
             console.warn("Pollinations Enhancer: Mismatched code block count during restoration.");
             currentHtml += placeholders[placeholderIndex++]; // append leftovers
        }

        return currentHtml;
    }


    function processLists(text) {
        const lines = text.split('\n');
        let result = [];
        let lastWasNumbered = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const numberedMatch = line.match(/^(\s*)(\d+)\.\s+(.*)/); // capture indent
            const dashMatch = line.match(/^(\s*)[-*]\s+(.*)/); // capture indent

            if (numberedMatch) {
                const indent = numberedMatch[1];
                const num = numberedMatch[2];
                const content = numberedMatch[3];
                // basic indent handling - could be more sophisticated
                const indentLevel = indent.length / 2; // rough estimate
                result.push(`<div class="list-item numbered-item" style="padding-left: ${indentLevel * 1.5}em;">${num}. ${content}</div>`);
                lastWasNumbered = true;
            } else if (dashMatch) {
                 const indent = dashMatch[1];
                 const content = dashMatch[2];
                 const indentLevel = indent.length / 2;
                 const bulletClass = lastWasNumbered ? "nested-bullet-item" : "bullet-item";
                 result.push(`<div class="list-item ${bulletClass}" style="padding-left: ${indentLevel * 1.5}em;">${content}</div>`);
                 // lastWasNumbered remains true if nested under numbered
            } else {
                 result.push(line); // pass through non-list lines
                 lastWasNumbered = line.trim() !== ''; // reset if line is not empty
            }
        }
        return result.join('\n');
    }

    function enhanceImagePage() {
        removeExistingButtons(); // clear old buttons first
        let mainImage = null;

        try {
            // prioritise images directly in body
            const directImages = Array.from(document.querySelectorAll('body > img'));
            if (directImages.length > 0) {
                let largestArea = 0;
                directImages.forEach(img => {
                    if (img.complete && img.naturalWidth > 30 && img.naturalHeight > 30) {
                        const area = img.naturalWidth * img.naturalHeight;
                        if (area > largestArea) {
                            largestArea = area;
                            mainImage = img;
                        }
                    } else if (!img.complete) {
                        // if image not loaded yet, re-run enhancement on load
                        img.addEventListener('load', () => setTimeout(enhanceImagePage, 100), { once: true });
                    }
                });
            }

            // fallback to searching all significant images if no direct body image found
            if (!mainImage) {
                const allImages = document.querySelectorAll('img');
                let largestArea = 0;
                allImages.forEach(img => {
                    if (img.width < 30 || img.height < 30) return; // ignore small icons
                    const area = img.naturalWidth * img.naturalHeight || img.width * img.height;
                    if (area > largestArea) {
                        largestArea = area;
                        mainImage = img;
                    }
                });
            }
        } catch (error) {
            console.error("Pollinations Enhancer: Error finding image element:", error);
        }

        const params = extractUrlParameters();
        if (mainImage) {
            // add width/height from image if available
            params.width = mainImage.naturalWidth || mainImage.width || params.width || '';
            params.height = mainImage.naturalHeight || mainImage.height || params.height || '';
            createCommonButtons(params, 'image', mainImage);
        } else {
            // if no image found yet, maybe it loads later? retry once.
            console.log("Pollinations Enhancer: Main image not found, scheduling retry.");
            setTimeout(enhanceImagePage, 600); // longer delay for retry
        }
    }

    function enhanceAudioPage() {
        removeExistingButtons();
        const params = extractUrlParameters();
        const audioSrc = findAudioSource() || window.location.href; // use page url as fallback
        createCommonButtons(params, 'audio', null, '', audioSrc);
    }

    function removeExistingButtons() {
        document.getElementById('pollinations-enhancer-buttons')?.remove();
        document.getElementById('metadata-box')?.remove();
    }

    function findAudioSource() {
        // check common audio/video tags and sources
        const mediaElements = document.querySelectorAll('audio, video');
        for (const el of mediaElements) {
            if (el.src && el.src.length > 10) return el.src;
            for (const source of el.querySelectorAll('source')) {
                if (source.src && source.src.length > 10) return source.src;
            }
        }

        // check links that look like audio files
        const audioExtRegex = /\.(mp3|wav|ogg|m4a|flac|aac)(\?|$)/i;
        for (const link of document.querySelectorAll('a[href]')) {
            try {
                const url = new URL(link.getAttribute('href'), window.location.href);
                if (audioExtRegex.test(url.pathname) || url.pathname.includes('/audio/')) {
                    return url.href;
                }
            } catch (e) { /* ignore invalid href */ }
        }

        // check elements with audio-related attributes
        for (const el of document.querySelectorAll('[type*="audio"], [src*=".mp3"], [src*="/audio/"]')) {
            const src = el.getAttribute('src') || el.getAttribute('data-src');
            if (src && src.length > 10) return new URL(src, window.location.href).href;
        }

        // check meta tags
        const metaOgAudio = document.querySelector('meta[property="og:audio"], meta[property="og:audio:url"]');
        if (metaOgAudio?.content) return metaOgAudio.content;

        // last resort: scan html for direct audio urls (less reliable)
        const htmlContent = document.documentElement.outerHTML;
        const audioUrlMatches = htmlContent.match(/https?:\/\/[^"'\s]+\.(mp3|wav|ogg|m4a)(\?[^"'\s]*)?/gi);
        if (audioUrlMatches?.length) return audioUrlMatches[0];

        return null; // no source found
    }

    // creates the floating button panel
    function createCommonButtons(
        params,
        type,
        targetElement = null,
        originalContent = '',
        resourceUrl = ''
    ) {
        try {
            removeExistingButtons(); // ensure clean state

            const buttonContainer = document.createElement('div');
            buttonContainer.id = 'pollinations-enhancer-buttons';
            buttonContainer.style.cssText = `
                position: fixed; top: 10px; right: 20px; z-index: 9999;
                display: flex; flex-direction: column; gap: 8px;
                align-items: flex-end;
            `; // stack buttons vertically

            // --- Text Page Specific Buttons ---
            if (type === 'text') {
                const themeToggleBtn = createButton('theme-toggle-btn', 'Toggle theme (Light/Dark)', '', toggleTheme);
                buttonContainer.appendChild(themeToggleBtn);
                updateThemeToggleButton(document.body.classList.contains('theme-dark'));

                if (targetElement) {
                    const copyContentBtn = createButton(
                        'copy-content-btn',
                        'Copy text content',
                        '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
                        () => {
                            const textToCopy = originalContent || (targetElement.innerText || targetElement.textContent || '');
                            navigator.clipboard.writeText(textToCopy).then(
                                () => flashButton(copyContentBtn, true),
                                () => flashButton(copyContentBtn, false)
                            );
                        }
                    );
                    buttonContainer.appendChild(copyContentBtn);
                }

                // --- Font Size Controls ---
                const fontSizeContainer = document.createElement('div');
                fontSizeContainer.className = 'font-size-controls';
                fontSizeContainer.style.cssText = 'display: flex; gap: 5px; justify-content: flex-end;';

                const decreaseFontBtn = createButton(
                    'decrease-font-btn', 'Decrease text size',
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
                     decreaseFontSize
                 );
                const increaseFontBtn = createButton(
                    'increase-font-btn', 'Increase text size',
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
                     increaseFontSize
                 );

                fontSizeContainer.appendChild(decreaseFontBtn);
                fontSizeContainer.appendChild(increaseFontBtn);
                buttonContainer.appendChild(fontSizeContainer);
            }

            // --- Image Download Button ---
            if (type === 'image' && targetElement?.src) {
                const timestamp = getFormattedTimestamp();
                const seedPart = params.seed ? `_${params.seed}` : '_noseed';
                let extension = '.jpg'; // default
                try {
                    const urlPath = new URL(targetElement.src).pathname;
                    const match = urlPath.match(/\.(jpg|jpeg|png|webp|gif)$/i);
                    if (match) {
                        extension = match[0].toLowerCase();
                        if (extension === '.jpeg') extension = '.jpg'; // normalise
                    }
                } catch (e) { console.warn("Enhancer: Couldn't parse img URL for extension", e); }

                const filename = `pollinations.ai${seedPart}_${timestamp}${extension}`;
                const saveImageBtn = createButton(
                    'save-image-btn', `Save image (${filename})`,
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
                    () => downloadResource(targetElement.src, filename, saveImageBtn, 'image')
                );
                buttonContainer.appendChild(saveImageBtn);
            }

            // --- Audio Download Button ---
            if (type === 'audio' && resourceUrl) {
                const timestamp = getFormattedTimestamp();
                const seedPart = params.seed ? `_${params.seed}` : '_noseed';
                let extension = '.mp3'; // default
                try {
                    const urlPath = new URL(resourceUrl).pathname;
                    const match = urlPath.match(/\.(mp3|wav|ogg|m4a|flac|aac)$/i);
                    if (match) extension = match[0].toLowerCase();
                } catch (e) { console.warn("Enhancer: Couldn't parse audio URL for extension", e); }

                const filename = `pollinations.ai${seedPart}_${timestamp}${extension}`;
                const saveAudioBtn = createButton(
                    'save-audio-btn', `Save audio (${filename})`,
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>',
                    () => downloadResource(resourceUrl, filename, saveAudioBtn, 'audio')
                );
                buttonContainer.appendChild(saveAudioBtn);
            }

            // --- Metadata Button & Box ---
            // check if any relevant parameter exists
            const hasMetadata = Object.entries(params).some(([key, value]) =>
                value && ['model', 'prompt', 'seed', 'voice', 'width', 'system', 'private', 'guidance_scale', 'negative_prompt', 'strength', 'steps', 'language'].includes(key)
            );

            if (hasMetadata) {
                const metadataBtn = createButton(
                    'metadata-btn', 'View metadata',
                    '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>',
                    () => { // toggle visibility and collapsed state
                        const box = document.getElementById('metadata-box');
                        if (box) {
                            const becomesVisible = !box.classList.contains('visible');
                            box.classList.toggle('visible');
                            if (becomesVisible) {
                                box.classList.remove('collapsed'); // always expand when showing
                            } else {
                                box.classList.add('collapsed'); // ensure marked collapsed when hiding
                            }
                            updateMetadataToggleIcon(box);
                        }
                    }
                );
                buttonContainer.appendChild(metadataBtn);
                createMetadataBox(params, type); // create the hidden box
            }

            // add the whole container to the page if it has any buttons
            if (buttonContainer.hasChildNodes()) {
                document.body.appendChild(buttonContainer);
            }

        } catch (error) {
            console.error("Pollinations Enhancer: Error creating common buttons:", error);
        }
    }

    function increaseFontSize() {
        const currentScale = parseFloat(GM_getValue(FONT_SIZE_KEY, '1')) || 1;
        const newScale = Math.min(currentScale + 0.1, 2.0).toFixed(1); // cap at 2.0
        GM_setValue(FONT_SIZE_KEY, newScale);
        applyFontSize();
    }

    function decreaseFontSize() {
        const currentScale = parseFloat(GM_getValue(FONT_SIZE_KEY, '1')) || 1;
        const newScale = Math.max(currentScale - 0.1, 0.7).toFixed(1); // cap at 0.7
        GM_setValue(FONT_SIZE_KEY, newScale);
        applyFontSize();
    }

    function applyFontSize() {
        const scale = GM_getValue(FONT_SIZE_KEY, '1') || '1';
        document.getElementById('font-size-style')?.remove(); // remove old style

        const styleEl = document.createElement('style');
        styleEl.id = 'font-size-style';
        // apply scale to font-size only, avoid scaling the whole container
        styleEl.textContent = `
            body.text-enhanced .content-container,
            body.text-enhanced .content-container-generated {
                font-size: calc(17px * ${scale}) !important;
            }
        `;
        document.head.appendChild(styleEl);
    }

    function createButton(id, title, innerHTML, onClick) {
        const btn = document.createElement('div'); // using div styled as button
        btn.id = id;
        btn.className = 'p-btn';
        btn.title = title;
        btn.innerHTML = innerHTML;
        btn.addEventListener('click', onClick);
        btn.style.position = 'relative'; // needed for potential future absolute elements inside
        btn.style.margin = '0'; // remove default margins
        return btn;
    }

    function flashButton(button, success) {
        if (!button) return;
        const originalColor = button.style.backgroundColor; // capture default
        button.style.backgroundColor = success ? 'var(--success-color)' : 'var(--error-color)';
        button.style.transform = 'scale(1.1)';
        setTimeout(() => {
            if (button) { // check if button still exists
                button.style.backgroundColor = ''; // revert to css default
                button.style.transform = 'scale(1)';
            }
        }, 1000);
    }

    // handles downloading, attempts exif stripping for images
    function downloadResource(url, filename, buttonToFlash, resourceType = 'unknown') {
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            responseType: 'blob',
            onload: function(response) {
                if (response.status === 200 && response.response) {
                    const originalBlob = response.response;

                    // attempt exif strip via canvas only for image types
                    if (resourceType === 'image' && originalBlob.type.startsWith('image/')) {
                        const img = document.createElement('img');
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        const objectURL = URL.createObjectURL(originalBlob); // temp url for img src

                        img.onload = () => {
                            try {
                                canvas.width = img.naturalWidth;
                                canvas.height = img.naturalHeight;
                                ctx.drawImage(img, 0, 0);

                                let mimeType = originalBlob.type;
                                // ensure canvas export supports the type, default to jpeg
                                if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) {
                                    console.warn(`Enhancer: Unsupported MIME type for canvas: ${mimeType}. Using image/jpeg.`);
                                    mimeType = 'image/jpeg';
                                    filename = filename.replace(/\.[^.]+$/, '.jpg'); // fix extension if changed
                                }

                                canvas.toBlob((processedBlob) => {
                                    if (processedBlob) {
                                        triggerDownload(processedBlob, filename, buttonToFlash, true);
                                    } else {
                                        console.error('Enhancer: Canvas toBlob failed. Downloading original.');
                                        triggerDownload(originalBlob, filename, buttonToFlash, false); // fallback
                                    }
                                    URL.revokeObjectURL(objectURL); // cleanup img src url
                                }, mimeType, 0.92); // quality for jpeg/webp

                            } catch (e) {
                                console.error("Enhancer: Error during canvas processing:", e);
                                URL.revokeObjectURL(objectURL);
                                triggerDownload(originalBlob, filename, buttonToFlash, false); // fallback
                            }
                        };

                        img.onerror = () => {
                            console.error('Enhancer: Failed to load image for EXIF stripping. Downloading original.');
                            URL.revokeObjectURL(objectURL);
                            triggerDownload(originalBlob, filename, buttonToFlash, false); // fallback
                        };

                        img.src = objectURL; // load the blob into the img element

                    } else {
                        // download non-images directly
                        triggerDownload(originalBlob, filename, buttonToFlash, true);
                    }

                } else {
                    console.error("Enhancer: Download failed:", response.statusText, response.status);
                    if (buttonToFlash) flashButton(buttonToFlash, false);
                    tryDirectDownload(url, filename, buttonToFlash); // fallback attempt
                }
            },
            onerror: function(response) {
                console.error("Enhancer: Download network error:", response.error);
                if (buttonToFlash) flashButton(buttonToFlash, false);
                tryDirectDownload(url, filename, buttonToFlash); // fallback attempt
            }
        });
    }

    // helper to create the download link and click it
    function triggerDownload(blob, filename, buttonToFlash, successStatus) {
        try {
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = filename;
            document.body.appendChild(link); // required for firefox
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href); // cleanup blob url
            if (buttonToFlash) flashButton(buttonToFlash, successStatus);
        } catch (e) {
            console.error("Enhancer: Error creating download link:", e);
            if (buttonToFlash) flashButton(buttonToFlash, false);
        }
    }

    // simple fallback using direct link (may not respect filename, no exif strip)
    function tryDirectDownload(url, filename, buttonToFlash) {
        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename; // works in chrome, less so elsewhere
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // cannot reliably flash success here
        } catch (err) {
            console.error("Enhancer: Direct download attempt failed:", err);
            if (buttonToFlash) flashButton(buttonToFlash, false);
        }
    }

    function createMetadataBox(params, type) {
        document.getElementById('metadata-box')?.remove(); // clear existing

        const metadataBox = document.createElement('div');
        metadataBox.id = 'metadata-box';
        metadataBox.className = 'meta-box'; // initially hidden by css (opacity 0)

        let contentHTML = '';
        // common params
        if (params.model) contentHTML += createMetaRow('Model', params.model);
        if (params.prompt) contentHTML += createMetaRow('Prompt', params.prompt, true); // allow copy
        if (params.seed) contentHTML += createMetaRow('Seed', params.seed);
        if (params.private) contentHTML += createMetaRow('Private', params.private);

        // image specific
        if (type === 'image') {
            if (params.width && params.height) contentHTML += createMetaRow('Size', `${params.width} × ${params.height}`);
            if (params.guidance_scale) contentHTML += createMetaRow('Guidance', params.guidance_scale); // shorter label
            if (params.negative_prompt) contentHTML += createMetaRow('Negative', params.negative_prompt, true); // shorter label, allow copy
            if (params.strength) contentHTML += createMetaRow('Strength', params.strength);
            if (params.steps) contentHTML += createMetaRow('Steps', params.steps);
        }

        // audio specific
        if (type === 'audio') {
            if (params.voice) contentHTML += createMetaRow('Voice', params.voice);
            if (params.format) contentHTML += createMetaRow('Format', params.format);
        }

        // text specific
        if (type === 'text') {
            if (params.system) contentHTML += createMetaRow('System', params.system, true); // allow copy
            if (params.language) contentHTML += createMetaRow('Language', params.language);
            if (params.modalities) contentHTML += createMetaRow('Modalities', params.modalities);
        }

        if (!contentHTML.trim()) return; // don't create box if no content

        metadataBox.innerHTML = `
            <div class="meta-header" title="Click to toggle details">
                <span>${type.charAt(0).toUpperCase() + type.slice(1)} Parameters</span>
                <span class="toggle-icon">▼</span>
            </div>
            <div class="meta-content">${contentHTML}</div>
        `;
        document.body.appendChild(metadataBox);

        // click header to toggle visibility/collapse
        metadataBox.querySelector('.meta-header').addEventListener('click', () => {
             const box = metadataBox; // already have ref
             const becomesVisible = !box.classList.contains('visible');
             box.classList.toggle('visible');
             if (becomesVisible) {
                 box.classList.remove('collapsed');
             } else {
                 box.classList.add('collapsed');
             }
             updateMetadataToggleIcon(box);
        });

        // add copy functionality to buttons in rows
        metadataBox.querySelectorAll('.copy-btn[data-copy-target]').forEach(copyBtn => {
            const targetLabel = copyBtn.getAttribute('data-copy-target');
            const textToCopy = params[targetLabel.toLowerCase().replace(' ', '_')]; // handle multi-word labels like 'guidance scale'

            if (textToCopy) {
                copyBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // prevent header click
                    navigator.clipboard.writeText(textToCopy).then(() => {
                        copyBtn.textContent = '✓'; // success indicator
                        setTimeout(() => { copyBtn.textContent = '📋'; }, 1200); // revert icon
                    }).catch(err => console.error(`Enhancer: Failed to copy ${targetLabel}:`, err));
                });
            } else {
                copyBtn.style.display = 'none'; // hide button if no text found
            }
        });

        updateMetadataToggleIcon(metadataBox); // set initial icon state
    }

    function updateMetadataToggleIcon(box) {
        const icon = box?.querySelector('.toggle-icon');
        if (icon) {
            // show down arrow if collapsed or hidden, up arrow if expanded/visible
            icon.textContent = box.classList.contains('collapsed') || !box.classList.contains('visible') ? '▼' : '▲';
        }
    }

    function createMetaRow(label, value, addCopyButton = false) {
        if (!value) return '';
        // basic html escaping for value display
        const cleanValue = String(value).replace(/</g, "<").replace(/>/g, ">");
        const copyBtnHTML = addCopyButton
            ? `<span class="copy-btn" title="Copy ${label}" data-copy-target="${label}">📋</span>`
            : '';
        return `
            <div class="meta-row">
                <div class="meta-label">${label}:</div>
                <div class="meta-value">${cleanValue}${copyBtnHTML}</div>
            </div>
        `;
    }

    // decode prompts, handle spaces encoded as '+' or '%20'
    function sanitizePrompt(text) {
        if (!text) return '';
        try {
            let decoded = text;
            // attempt decoding multiple times for nested encoding
            for (let i = 0; i < 3; i++) {
                if (decoded.includes('%')) decoded = decodeURIComponent(decoded);
                else break; // stop if no more percent signs
            }
            // replace '+' with space and remove potential replacement characters
            return decoded.replace(/\+/g, ' ').replace(/\uFFFD/gu, '').trim();
        } catch (e) {
            console.warn("Enhancer: Failed to fully decode prompt:", text, e);
            // fallback: basic space replacement
            return text.replace(/\+/g, ' ').replace(/%20/g, ' ').trim();
        }
    }

    // helper for consistent timestamp format
    function getFormattedTimestamp() {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}${hours}${minutes}${seconds}`; // YYYYMMDDHHMMSS
    }

    function extractUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const path = window.location.pathname;
        let rawPrompt = '';

        // prefer 'prompt' param if present
        if (urlParams.has('prompt')) {
            rawPrompt = urlParams.get('prompt');
        } else {
            // fallback: try to get prompt from the last part of the path
            const pathSegments = decodeURIComponent(path).split('/').filter(Boolean);
            if (pathSegments.length > 0) {
                const lastSegment = pathSegments[pathSegments.length - 1];
                // basic check: assume it's a prompt if it's reasonably long and doesn't look like a file/id
                 if (lastSegment.length > 5 && !lastSegment.match(/^[\w-]{8,}$/) && !lastSegment.includes('.')) {
                     rawPrompt = lastSegment;
                 }
            }
        }

        // return object with all relevant params, sanitising prompts
        return {
            prompt: sanitizePrompt(rawPrompt),
            model: urlParams.get('model') || '',
            seed: urlParams.get('seed') || '',
            voice: urlParams.get('voice') || '',
            width: urlParams.get('width') || '',
            height: urlParams.get('height') || '',
            system: sanitizePrompt(urlParams.get('system') || ''),
            private: urlParams.get('private') || '', // boolean-like
            format: urlParams.get('format') || '', // audio format
            modalities: urlParams.get('modalities') || '',
            guidance_scale: urlParams.get('guidance_scale') || '',
            negative_prompt: sanitizePrompt(urlParams.get('negative_prompt') || ''),
            strength: urlParams.get('strength') || '',
            steps: urlParams.get('steps') || '',
            language: urlParams.get('language') || '',
        };
    }

    function addStyles() {
        GM_addStyle(`
            :root {
                --text-color: #f0f0f0;
                --bg-color: #1a1a1a;
                --accent: #3498db;
                --accent-hover: #2980b9;
                --light-bg: #f2f2f2;
                --light-text: #333333;
                --light-content-bg: #ffffff;
                --dark-content-bg: #2d2d2d;
                --border-color-dark: #444;
                --border-color-light: #ddd;
                --button-bg: #333; /* Unused currently */
                --button-hover-bg: #444; /* Unused currently */
                --success-color: #27ae60;
                --error-color: #e74c3c;
                --code-bg-dark: #1e1e1e;
                --code-bg-light: #f8f8f8;
                --code-header-bg-dark: linear-gradient(90deg, rgba(30,30,30,1) 0%, rgba(45,45,45,1) 100%);
                --code-header-bg-light: linear-gradient(90deg, rgba(245,245,245,1) 0%, rgba(235,235,235,1) 100%);
                --blockquote-border: #3498db; /* Same as accent */
                --blockquote-bg-dark: rgba(255,255,255,0.05);
                --blockquote-bg-light: rgba(0,0,0,0.03);
            }
            body {
                transition: background-color 0.3s, color 0.3s;
            }
            body.theme-light {
                background-color: var(--light-bg) !important;
                color: var(--light-text) !important;
            }
            body.theme-dark {
                background-color: var(--bg-color) !important;
                color: var(--text-color) !important;
            }

            /* Buttons */
            .p-btn {
                background-color: var(--accent);
                color: white;
                border: none;
                border-radius: 50%;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                /* margin: 5px; Removed, using gap in container */
                transition: all 0.2s ease-in-out;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                flex-shrink: 0; /* Prevent shrinking in flex container */
            }
            .p-btn:hover {
                background-color: var(--accent-hover);
                transform: scale(1.05);
            }
            .p-btn svg {
                pointer-events: none; /* Prevent svg from capturing clicks */
            }
            .font-size-controls {
                display: flex;
                gap: 5px;
                justify-content: flex-end; /* Align to right within its space */
            }
            .font-size-controls .p-btn {
                width: 30px; /* Slightly smaller font buttons */
                height: 30px;
            }

            /* Metadata Box */
            .meta-box {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background-color: rgba(45, 45, 45, 0.9);
                color: var(--text-color);
                border-radius: 8px;
                padding: 12px;
                max-width: 320px;
                width: auto;
                font-size: 13px;
                line-height: 1.5;
                z-index: 9998;
                transition: opacity 0.3s, transform 0.3s, height 0.3s ease-out, padding 0.3s ease-out;
                box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                opacity: 0;
                transform: translateY(10px);
                pointer-events: none;
                overflow: hidden;
                backdrop-filter: blur(3px);
                -webkit-backdrop-filter: blur(3px);
            }
            body.theme-light .meta-box {
                background-color: rgba(255, 255, 255, 0.9);
                color: var(--light-text);
            }
            .meta-box.visible {
                opacity: 1;
                transform: translateY(0);
                pointer-events: auto;
            }
            .meta-box.collapsed {
                 /* Animate height collapse */
                height: 24px; /* Approx height of header */
                padding-top: 5px;
                padding-bottom: 5px;
                min-height: 24px;
                overflow: hidden;
            }
            .meta-box.collapsed .meta-content {
                display: none;
            }
            .meta-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
                cursor: pointer;
                user-select: none;
                font-weight: bold;
            }
            .meta-box.collapsed .meta-header {
                margin-bottom: 0; /* Remove margin when collapsed */
            }
            .meta-header .toggle-icon {
                font-size: 16px;
                padding: 0 5px;
                transition: transform 0.2s; /* Rotate icon */
            }
            .meta-content {
                margin-top: 5px;
            }
            .meta-row {
                display: flex;
                margin-bottom: 5px;
                align-items: baseline; /* Align label and value nicely */
            }
            .meta-label {
                font-weight: 600;
                width: 75px; /* Slightly wider label */
                color: #aaa;
                flex-shrink: 0;
                padding-right: 5px;
            }
            body.theme-light .meta-label {
                color: #555;
            }
            .meta-value {
                flex: 1;
                word-break: break-word; /* Wrap long values */
                display: inline; /* Helps with copy button alignment */
            }
            .copy-btn {
                display: inline-block; /* Make it inline with text */
                cursor: pointer;
                margin-left: 8px;
                font-size: 14px;
                opacity: 0.6;
                transition: opacity 0.2s;
                vertical-align: middle; /* Align with text */
                user-select: none;
            }
            .copy-btn:hover {
                opacity: 1;
            }

            /* Link Preview */
            .preview {
                position: absolute;
                display: none;
                max-width: 350px;
                background-color: #383838;
                color: #eee;
                border-radius: 6px;
                box-shadow: 0 5px 20px rgba(0, 0, 0, 0.4);
                padding: 10px 12px;
                font-size: 13px;
                line-height: 1.4;
                z-index: 10001;
                pointer-events: none;
                transition: opacity 0.15s ease-in-out;
                opacity: 0;
                border: 1px solid rgba(255, 255, 255, 0.1);
            }
            body.theme-light .preview {
                background-color: white;
                color: #333;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
                border: 1px solid #eee;
            }
            .preview.active {
                opacity: 1;
                pointer-events: auto; /* Allow interaction when visible */
                display: block;
            }
            .preview-header {
                display: flex;
                align-items: center;
                margin-bottom: 6px;
                font-weight: 600;
                color: #f5f5f5; /* Slightly off-white */
            }
            body.theme-light .preview-header {
                color: #444;
            }
            .preview-icon {
                width: 16px;
                height: 16px;
                margin-right: 7px;
                border-radius: 3px;
                background-color: var(--accent);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 10px;
                font-weight: bold;
                color: white;
                overflow: hidden;
                flex-shrink: 0;
                text-align: center;
            }
            .preview-icon img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            .preview-content {
                max-height: 100px; /* Limit height */
                overflow: hidden;
                text-overflow: ellipsis;
                /* Consider white-space: normal; if needed */
            }
            .preview-url {
                font-size: 11px;
                color: #aaa;
                margin-top: 6px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            body.theme-light .preview-url {
                color: #777;
            }

            /* Text Enhancement Styles */
            body.text-enhanced {
                font-family: Arial, sans-serif !important;
                /* Base font size set by applyFontSize */
                line-height: 1.55 !important; /* Slightly more spacing */
            }
            .content-container, .content-container-generated {
                max-width: 850px !important;
                margin: 25px auto !important; /* More top/bottom margin */
                padding: 25px 35px !important; /* More padding */
                border-radius: 8px !important;
                /* Font size applied via JS */
            }
            body.theme-dark .content-container,
            body.theme-dark .content-container-generated {
                background-color: var(--dark-content-bg) !important;
                box-shadow: 0 3px 10px rgba(0,0,0,0.2);
            }
            body.theme-light .content-container,
            body.theme-light .content-container-generated {
                background-color: var(--light-content-bg) !important;
                box-shadow: 0 2px 10px rgba(0,0,0,0.08) !important;
            }

            /* Headings */
            .content-container h1, .content-container h2, .content-container h3,
            .content-container h4, .content-container h5, .content-container h6 {
                margin-top: 1.2em !important;
                margin-bottom: 0.5em !important;
                font-weight: 600;
                line-height: 1.2;
            }
            body.theme-dark .content-container h1,
            body.theme-dark .content-container h2,
            body.theme-dark .content-container h3 { color: #eee !important; }
            body.theme-light .content-container h1,
            body.theme-light .content-container h2,
            body.theme-light .content-container h3 { color: #222 !important; }

            .content-container h1 {
                font-size: 2.1em !important;
                border-bottom: 1px solid var(--border-color-dark);
                padding-bottom: 0.3em;
            }
            .content-container h2 {
                font-size: 1.7em !important;
                border-bottom: 1px solid var(--border-color-dark);
                padding-bottom: 0.3em;
            }
            .content-container h3 { font-size: 1.4em !important; }
            .content-container h4 { font-size: 1.2em !important; }
            .content-container h5 { font-size: 1.1em !important; }
            .content-container h6 { font-size: 1.0em !important; color: #888; } /* Dim h6 */

            body.theme-light .content-container h1,
            body.theme-light .content-container h2 { border-bottom-color: var(--border-color-light); }

            /* Links */
            .content-container a {
                color: var(--accent) !important;
                text-decoration: none !important;
                transition: color 0.2s;
            }
            .content-container a:hover {
                color: var(--accent-hover) !important;
                text-decoration: underline !important;
            }

            /* Blockquotes */
            .content-container blockquote,
            .content-container .blockquote-single,
            .content-container .blockquote-multi {
                border-left: 4px solid var(--blockquote-border) !important;
                padding: 10px 18px !important; /* More padding */
                margin: 1em 0 !important;
                border-radius: 0 4px 4px 0; /* Rounded right corners */
                font-style: italic; /* Often blockquotes are italicized */
            }
            body.theme-dark .content-container blockquote,
            body.theme-dark .content-container .blockquote-single,
            body.theme-dark .content-container .blockquote-multi {
                color: #ccc !important;
                background-color: var(--blockquote-bg-dark);
            }
            body.theme-light .content-container blockquote,
            body.theme-light .content-container .blockquote-single,
            body.theme-light .content-container .blockquote-multi {
                color: #555 !important;
                background-color: var(--blockquote-bg-light);
            }

            /* Lists - Handled by divs generated in JS */
            .content-container .list-item {
                 margin-bottom: 0.3em;
                 line-height: 1.4;
            }
             .content-container .numbered-item {
                font-weight: normal; /* Less bold than header */
             }
             .content-container .bullet-item::before {
                 content: "•"; /* Standard bullet */
                 margin-right: 8px;
                 color: var(--accent); /* Themed bullet */
             }
             .content-container .nested-bullet-item::before {
                 content: "◦"; /* Open circle for nested */
                 margin-right: 8px;
                 color: var(--accent);
             }
            /* Ensure JS-generated padding is respected */
             .content-container .bullet-item,
             .content-container .nested-bullet-item {
                display: list-item; /* Use list-item display for pseudo-elements */
                list-style-position: inside; /* Keep bullet inside padding */
                list-style-type: none; /* Hide default browser bullet */
             }

             /* Horizontal Rule */
            .content-container hr.markdown-hr {
                border: 0;
                height: 1px;
                background: var(--border-color-dark);
                margin: 1.5em 0; /* More spacing around hr */
            }
            body.theme-light .content-container hr.markdown-hr {
                background: var(--border-color-light);
            }

             /* Bold / Italic / Strikethrough */
            .content-container strong, .content-container b { font-weight: 600 !important; }
            .content-container em, .content-container i { font-style: italic !important; }
            .content-container del { text-decoration: line-through; color: #888; } /* Dim strikethrough */

            /* Code Block Styling */
            .code-block-container {
                position: relative;
                background-color: var(--code-bg-dark) !important;
                border: 1px solid var(--border-color-dark);
                border-radius: 6px !important;
                margin: 1.2em 0 !important; /* Consistent margin */
                padding: 0 !important; /* Remove padding, handled by children */
                overflow: hidden !important;
            }
            body.theme-light .code-block-container {
                background-color: var(--code-bg-light) !important;
                border-color: var(--border-color-light);
            }

            .code-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 12px; /* Slightly tighter header */
                background: var(--code-header-bg-dark);
                border-bottom: 1px solid var(--border-color-dark);
                font-family: 'Consolas', 'Monaco', monospace !important;
                font-size: 12px;
                color: #ccc;
            }
            body.theme-light .code-header {
                background: var(--code-header-bg-light);
                border-bottom: 1px solid var(--border-color-light);
                color: #555;
            }

            .code-language {
                color: #aaa;
                text-transform: lowercase;
                font-weight: bold;
            }
            body.theme-light .code-language {
                color: #666;
            }

            .code-copy-btn {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.2);
                color: #fff;
                font-size: 11px;
                padding: 3px 8px; /* Smaller padding */
                border-radius: 4px;
                cursor: pointer;
                transition: all 0.2s;
                font-weight: bold;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                user-select: none;
            }
            body.theme-light .code-copy-btn {
                background: rgba(0,0,0,0.05);
                border: 1px solid rgba(0,0,0,0.15);
                color: #333;
            }
            .code-copy-btn:hover {
                background-color: rgba(255,255,255,0.2);
                transform: translateY(-1px);
                box-shadow: 0 1px 3px rgba(0,0,0,0.2);
            }
            body.theme-light .code-copy-btn:hover {
                background-color: rgba(0,0,0,0.1);
            }

            /* Actual code area */
            .code-block-container code {
                display: block;
                padding: 15px !important; /* Padding inside code area */
                overflow-x: auto !important; /* Allow horizontal scroll */
                font-family: 'Consolas', 'Monaco', monospace !important;
                font-size: 0.92em; /* Slightly adjust size */
                line-height: 1.5;
                color: #e9e9e9;
                background: transparent !important; /* Ensure no extra bg */
                border-radius: 0 !important; /* No radius on code tag itself */
            }
            body.theme-light .code-block-container code {
                color: #2d2d2d !important;
            }

            /* Inline code */
            .content-container code.inline-code {
                font-family: 'Consolas', 'Monaco', monospace !important;
                background-color: rgba(128, 128, 128, 0.15) !important;
                padding: 2px 5px !important;
                border-radius: 4px !important;
                font-size: 0.9em;
                color: inherit; /* Inherit surrounding text color */
                vertical-align: baseline; /* Align nicely with text */
            }
            body.theme-dark .content-container code.inline-code {
                 background-color: rgba(255, 255, 255, 0.1) !important;
            }
             body.theme-light .content-container code.inline-code {
                 background-color: rgba(0, 0, 0, 0.08) !important;
             }
        `);
    }

})();