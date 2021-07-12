// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.
const dateString = new Date().toISOString().split(".")[0].replace("T", "");
const PAGE_NAME = `Screen Names ${dateString}`;
const STORED_FILE_URL = "storedFileUrl";
const STORAGE_EXPIRE_TIME = 1 * 60 * 1000; // Restore file URL within 30 min.
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
        const duplicatedSkip = options.skipDuplicated && screenList.map(scr => scr.name).indexOf(node.name) !== -1;
        console.log(node.name, duplicatedSkip);
        if (isValidType && !underscoreSkip && !duplicatedSkip) {
            const link = `https://www.figma.com/file/${fileKey}/${figma.root.name}?node-id=${encodeURIComponent(node.id)}`;
            screenList.push({ link, name: node.name });
        }
    }
    // ページを作成してテキストを挿入
    const page = figma.createPage();
    page.name = PAGE_NAME;
    figma.loadFontAsync({ family: "Roboto", style: "Regular" })
        .then(() => {
        for (const page of figma.root.children) {
            if (page.name === PAGE_NAME) {
                const nameNode = figma.createText();
                const sortedScreens = screenList.sort((a, b) => {
                    if (a.name < b.name) {
                        return -1;
                    }
                    if (a.name > b.name) {
                        return 1;
                    }
                    return 0;
                });
                nameNode.characters = sortedScreens.map((screen) => screen.name).join("\n");
                page.appendChild(nameNode);
                const linkNode = figma.createText();
                linkNode.characters = sortedScreens.map((screen) => screen.link).join("\n");
                linkNode.x = 400;
                page.appendChild(linkNode);
            }
        }
    })
        .catch((error) => {
        console.log(error);
    });
    // プラグイン終了
    figma.closePlugin(`New page \"${PAGE_NAME}\" created.`);
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
