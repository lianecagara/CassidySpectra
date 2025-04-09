import Shoti from "shoti";
export const meta = {
  name: "shoti",
  description: "Send a random Shoti video",
  author: "0xVoid",
  version: "1.0.1",
  usage: "{prefix}{name}",
  category: "bold",
  permissions: [0],
  noPrefix: "both",
  waitingTime: 10,
  requirement: "3.0.0",
  otherNames: ["shoti"],
  icon: "😋",
};
export async function entry({
  output
}) {
  try {
    const shoti = new Shoti("$shoti-b04f8c279e");
    const data = await shoti.getShoti();
    const err = data
    const content = data?.content
    const region = data?.region ?? "";
    const instagram = data?.user?.instagram ?? "";
    const nickname = data?.user?.nickname ?? "";
    const signature = data?.user?.signature ?? "";
    const twitter = data?.user?.twitter ?? "";
    const username = data?.user?.username ?? "";

    let msg = ``;

    if (region !== '') {
      msg += `Country: ${region}\n`;
    }
    if (instagram !== '') {
      msg += `Instagram: ${instagram}\n`;
    }
    if (nickname !== '') {
      msg += `Nickname: ${nickname}\n`;
    }
    if (signature !== '') {
      msg += `Signature: ${signature}\n`;
    }
    if (twitter !== '') {
      msg += `Twitter: ${twitter}\n`;
    }
    if (username !== '') {
      msg += `Username: ${username}\n`;
    }

    await output.reply({
      body: msg.trim(),
      attachment: await global.utils.getStreamFromURL(content)
    });
  } catch (error) {
    await output.reply({
      body: `Failed to fetch Shoti video: ${err.message || err}`
    });
  }
};

export const style = {
  title: "Random Shoti Video",
  titleFont: "bold",
  contentFont: "fancy",
};
