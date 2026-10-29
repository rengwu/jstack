import {assembleCLI} from '../../fungi-ui/scripts/assemble.mjs';
await assembleCLI({assets:new URL('../assets/',import.meta.url),entry:'form.html',prefix:'grill-form-'}).catch(error=>{console.error(error.message);process.exitCode=1;});
