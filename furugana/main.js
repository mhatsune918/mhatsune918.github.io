const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");
const Kuroshiro = require("kuroshiro").default;

const { data } = require("./datasource");

const kuroshiro = new Kuroshiro();

let main = async () => {
  await kuroshiro.init(new KuromojiAnalyzer())

  let ret = {};
  for (const [key, items] of Object.entries(data)) {
    let new_items = [];
    for (item of items) {
      let new_item = {
        dialog: []
      };
      for (d of item.dialog) {
        let ret = {
          original: (await kuroshiro.convert(d.original, { mode:"furigana", to:"hiragana" })).trim(),
          translation: d.translation.trim(),
        };
        new_item.dialog.push(ret);
      }
      new_items.push(new_item);
    }
    ret[key] = new_items;
  }

  console.log(`const rootdata = ${JSON.stringify(ret, null, 2)};`);
}

main().catch(console.error)

