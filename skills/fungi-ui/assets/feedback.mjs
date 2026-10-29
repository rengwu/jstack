// Workflow supplies its snapshot/validation; this owns save ordering and UI state.
export function createFeedback({form,controls,snapshot,ready=()=>true,api=globalThis.fungi,restored=false}){
 const {submit,cancel,status,message}=controls,submitLabel=submit.textContent;
 let busy=false,timer,saving=Promise.resolve(),generation=0;
 const showError=error=>{message.textContent=error.message;message.hidden=false;};
 function refresh(){try{if(!ready())throw new Error('Images are still being prepared.');snapshot(true);submit.disabled=busy;}catch{submit.disabled=true;}}
 function save(){
  clearTimeout(timer);timer=undefined;if(busy)return saving;
  let value;const current=generation;
  try{if(!ready())throw new Error('Images are still being prepared.');value=snapshot(false);}catch(error){status.textContent='Draft not saved';status.hidden=false;showError(error);return saving;}
  saving=saving.catch(()=>{}).then(()=>api.saveDraft(value.data,value.attachments)).then(()=>{if(current===generation&&!timer){status.textContent='Draft saved';status.hidden=false;}}).catch(error=>{status.textContent='Draft not saved';status.hidden=false;showError(error);});
  return saving;
 }
 function changed(){
  refresh();if(busy)return;generation++;clearTimeout(timer);message.hidden=true;status.hidden=false;
  if(!ready()){status.textContent='Preparing image…';return;}
  status.textContent='Saving draft…';timer=setTimeout(save,400);
 }
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  let value;try{if(!ready())throw new Error('Images are still being prepared.');value=snapshot(true);}catch(error){showError(error);return;}
  clearTimeout(timer);busy=true;form.inert=true;submit.disabled=true;submit.textContent='Submitting…';message.hidden=true;
  try{await saving;await api.submit(value.data,value.attachments);}catch(error){busy=false;form.inert=false;submit.textContent=submitLabel;refresh();showError(error);message.focus();}
 });
 cancel.addEventListener('click',async()=>{
  if(busy)return;const pending=save();busy=true;form.inert=true;
  try{await pending;await api.cancel();}catch(error){busy=false;form.inert=false;showError(error);}
 });
 cancel.disabled=false;refresh();if(restored){status.textContent='Saved draft restored';status.hidden=false;}
 return {changed,save,refresh,showError};
}
