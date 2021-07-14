// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// This shows the HTML page in "ui.html".
// figma.showUI(__html__);

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
/*
figma.ui.onmessage = msg => {
  // One way of distinguishing between different types of messages sent from
  // your HTML page is to use an object with a "type" property like this.
  if (msg.type === 'create-rectangles') {
    const nodes: SceneNode[] = [];
    for (let i = 0; i < msg.count; i++) {
      const rect = figma.createRectangle();
      rect.x = i * 150;
      rect.fills = [{type: 'SOLID', color: {r: 1, g: 0.5, b: 0}}];
      figma.currentPage.appendChild(rect);
      nodes.push(rect);
    }
    figma.currentPage.selection = nodes;
    figma.viewport.scrollAndZoomIntoView(nodes);
  }

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  figma.closePlugin();
};
*/

type MainOptions = {
  skipUnderscore: boolean,
  skipDuplicated: boolean,
}

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


function main(fileKey: string, options: MainOptions) {
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
      const link = `https://www.figma.com/file/${fileKey}/${encodeURI(figma.root.name)}?node-id=${encodeURIComponent(node.id)}`;
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
            if (a.name < b.name) { return -1; }
            if (a.name > b.name) { return 1; }
            return 0;
          });
          let nameCharIndex = 0;
          // nameNode.characters = sortedScreens.map((screen) => screen.name).join("\n");
          sortedScreens.forEach((screen) => {
            nameNode.characters += `${screen.name}\n`;
            const indexOffset = screen.name.length;
            console.log(nameCharIndex, nameCharIndex + indexOffset, screen.link);
            nameNode.setRangeHyperlink(
              nameCharIndex,
              nameCharIndex + indexOffset,
              { type: "URL", value: screen.link }
            );
            nameCharIndex += (indexOffset + 1);
          });
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
    })

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
    } else {
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
}
