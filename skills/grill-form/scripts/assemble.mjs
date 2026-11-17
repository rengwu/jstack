import {assembleCLI} from '../../fungi-ui/scripts/assemble.mjs';
import {normalizeSpec} from '../assets/model.mjs';
await assembleCLI({assets:new URL('../assets/',import.meta.url),entry:'form.html',prefix:'grill-form-',validate:normalizeSpec}).catch(error=>{console.error(error.message);process.exitCode=1;});
