import {assembleCLI} from '../../fungi-ui/scripts/assemble.mjs';
import {normalizeInput} from '../assets/model.mjs';
await assembleCLI({assets:new URL('../assets/',import.meta.url),entry:'outcome.html',prefix:'show-outcome-',validate:normalizeInput}).catch(error=>{console.error(error.message);process.exitCode=1;});
