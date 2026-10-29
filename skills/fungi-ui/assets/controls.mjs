import {element} from './dom.mjs';
export function button(label,{className='',type='button',onClick}={}){
 const node=element('button',label,className);node.type=type;if(onClick)node.addEventListener('click',onClick);return node;
}
export function createField(label,{className=''}={}){
 const field=element('fieldset',undefined,className);field.append(element('legend',label));return field;
}
export function createChoice({type='radio',id,name,value,label,checked=false,recommendation='',onChange=()=>{},className=''}){
 const node=element('label',undefined,['choice',className].filter(Boolean).join(' '));
 const input=element('input');input.type=type;if(id)input.id=id;if(name)input.name=name;input.value=value;input.checked=checked;
 const copy=element('span',undefined,'choice-copy'),caption=element('span',label);caption.id=(id??crypto.randomUUID())+'-label';copy.append(caption);input.setAttribute('aria-labelledby',caption.id);
 if(recommendation){const badge=element('span',' Recommended','choice-badge'),reason=element('span',recommendation,'choice-recommendation');caption.append(badge);reason.id=caption.id+'-reason';input.setAttribute('aria-describedby',reason.id);copy.append(reason);}
 input.addEventListener('change',()=>onChange(input.checked,input.value));node.append(input,copy);return {element:node,input};
}
export function createChoiceCard({control,preview,onSelect}){
 const card=element('div',undefined,'choice-card');card.addEventListener('click',event=>{if(!control.contains(event.target))onSelect();});card.append(preview,control);return card;
}
export function createFeedbackControls({cancelLabel='Cancel',submitLabel='Submit feedback'}={}){
 const actions=element('div');actions.id='actions';
 const cancel=button(cancelLabel),submit=button(submitLabel,{type:'submit'});cancel.id='cancel';submit.id='submit';cancel.disabled=true;submit.disabled=true;actions.append(cancel,submit);
 const status=element('p',undefined,'hint');status.id='draft-message';status.setAttribute('role','status');status.hidden=true;
 const message=element('p',undefined,'error');message.id='message';message.setAttribute('role','alert');message.tabIndex=-1;message.hidden=true;
 return {actions,cancel,submit,status,message};
}
