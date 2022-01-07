const dateString = new Date().toISOString().split(".")[0].replace("T", "");
const PAGE_NAME = `Screen Names ${dateString}`;
const STORED_FILE_URL = "storedFileUrl";
const STORAGE_EXPIRE_TIME = 30 * 60 * 1000; // Restore file URL within 30 min.
const NODE_OFFSET_X = 20;
const FONT_SIZE = 12;
const LINE_HEIGHT = { value: 20, unit: "PIXELS" };
function trim(text) {
    return text.replace(/^\s+|\s+$/g, "");
}
function snakeCase(text) {
    return text.replace(/\.?\s?([A-Z]+)/g, (x, y) => `_${y.toLowerCase()}`).replace(/^_/, "");
}
function convertToScreenId(text) {
    // "Screen A - State" will be "screen_a__state"
    return snakeCase(text).replace(/\W/g, "_");
}
figma.showUI(__html__, { height: 250 });
figma.clientStorage.getAsync(STORED_FILE_URL)
    .then(({ fileUrl, expire }) => {
    if (Number(new Date()) < expire) {
        figma.ui.postMessage({ fileUrl });
    }
});
function main(fileKey, options) {
    const screenList = [];
    // スクリーンが選択されてなければ停止
    if (figma.currentPage.selection.length === 0) {
        figma.closePlugin();
        alert("Please select at least one frame.");
        return;
    }
    // 名前とURLを作成
    for (const node of figma.currentPage.selection) {
        const isValidType = node.type === "FRAME";
        const underscoreSkip = options.skipUnderscore && node.name.match(/^_/) !== null;
        const duplicatedSkip = options.skipDuplicated && screenList.some(scr => scr.name === node.name);
        if (!isValidType || underscoreSkip || duplicatedSkip) {
            continue;
        }
        const link = `https://www.figma.com/file/${fileKey}/${figma.root.name}?node-id=${encodeURIComponent(node.id)}`;
        screenList.push({ link, name: node.name });
    }
    // ソートしてスラッシュ区切りをマージ
    const filteredScreens = screenList.sort((a, b) => {
        if (a.name < b.name) {
            return -1;
        }
        if (a.name > b.name) {
            return 1;
        }
        return 0;
    }).map((scr) => {
        if (!options.slashMerge) {
            return scr;
        }
        const prefix = scr.name.indexOf("/") !== -1 ? trim(scr.name.split("/")[0]) : null;
        if (!!prefix) {
            if (screenList.some(item => item.name === prefix)) {
                // prefix と完全一致の名前があればスキップ
                return null;
            }
            else {
                // 検知したがリストにない場合は prefix を名前にして追加
                scr.name = prefix;
                return scr;
            }
        }
        return scr;
    }).filter(scr => scr);
    // ページを作成してテキストを挿入
    const page = figma.createPage();
    page.name = PAGE_NAME;
    figma.loadFontAsync({ family: "Roboto", style: "Regular" })
        .then(() => {
        for (const page of figma.root.children) {
            if (page.name === PAGE_NAME) {
                const indexNode = figma.createText();
                indexNode.name = "Index";
                indexNode.fontSize = FONT_SIZE;
                indexNode.lineHeight = LINE_HEIGHT;
                indexNode.characters = filteredScreens.map((screen, index) => index + 1).join("\n");
                page.appendChild(indexNode);
                const nameNode = figma.createText();
                nameNode.name = "Screen Name";
                nameNode.fontSize = FONT_SIZE;
                nameNode.lineHeight = LINE_HEIGHT;
                nameNode.characters = filteredScreens.map((screen) => screen.name).join("\n");
                nameNode.x = indexNode.width + NODE_OFFSET_X;
                page.appendChild(nameNode);
                const idNode = figma.createText();
                idNode.name = "ID-like String";
                idNode.fontSize = FONT_SIZE;
                idNode.lineHeight = LINE_HEIGHT;
                idNode.characters = filteredScreens.map((screen) => convertToScreenId(screen.name)).join("\n");
                idNode.x = indexNode.width + nameNode.width + NODE_OFFSET_X * 2;
                page.appendChild(idNode);
                const linkNode = figma.createText();
                linkNode.name = "Link";
                linkNode.fontSize = FONT_SIZE;
                linkNode.lineHeight = LINE_HEIGHT;
                linkNode.characters = filteredScreens.map((screen) => screen.link).join("\n");
                // Start & end will be like:
                // 0..20
                // 21..45
                // 46..100
                let linkIndex = 0;
                filteredScreens.forEach((screen) => {
                    const linkLength = screen.link.length;
                    // @ts-ignore
                    linkNode.setRangeHyperlink(linkIndex, linkIndex + linkLength, { type: "URL", value: screen.link });
                    linkIndex += linkLength + 1;
                });
                linkNode.x = indexNode.width + nameNode.width + idNode.width + NODE_OFFSET_X * 3;
                page.appendChild(linkNode);
                // プラグイン終了
                figma.closePlugin(`New page \"${PAGE_NAME}\" created.`);
            }
        }
    })
        .catch((error) => {
        console.log(error);
        // プラグイン終了
        figma.closePlugin('Something went wrong.');
    });
}
figma.ui.onmessage = (msg) => {
    if (msg.type === "screen-name-export") {
        // Only private plugin can access fileKey.
        // https://www.figma.com/plugin-docs/api/figma/#filekey
        const { fileUrl, options } = msg;
        const matched = fileUrl.match(/https:\/\/www\.figma\.com\/file\/(.*)\//);
        if (matched === null) {
            figma.closePlugin();
            alert("File URL is invalid.");
        }
        else {
            figma.clientStorage.setAsync(STORED_FILE_URL, { fileUrl, expire: Number(new Date()) + STORAGE_EXPIRE_TIME })
                .then(() => {
                const fileKey = matched[1];
                main(fileKey, options);
            });
        }
    }
    if (msg.type === "cancel") {
        figma.closePlugin();
    }
};
