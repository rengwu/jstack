import {assemble} from './assemble.mjs';
console.log(JSON.stringify(await assemble({assets:new URL('../examples/',import.meta.url),entry:'gallery.html',prefix:'fungi-ui-gallery-'})));
