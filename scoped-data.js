(function(){
  'use strict';

  const INDEX_VERSION=2;
  const GLOBAL_ROLES=new Set(['super_admin','director','chief_engineer','republic_tb_engineer']);
  const GLOBAL_TP_ROLES=new Set(['super_admin','director','chief_engineer','republic_tb_engineer','chief_dispatcher','dispatcher']);
  let tpCache={};
  let userCache={};
  let indexVersionCache=null;

  function db(){return firebase.database();}
  function me(){return window.HETKAuth&&window.HETKAuth.currentUser;}
  function snapshot(value){return {val:function(){return value||{};},exists:function(){return !!value&&Object.keys(value).length>0;}};}
  function keysTrue(value){return Object.keys(value||{}).filter(function(key){return value[key]===true||value[key]===1;});}
  function globalAccount(account){return !!(account&&(account.rootAccess||GLOBAL_ROLES.has(account.role)));}
  function globalTPAccount(account){return !!(account&&(account.rootAccess||GLOBAL_TP_ROLES.has(account.role)));}
  function tpFolderIds(tp){
    const ids=keysTrue(tp&&tp.folders);
    if(!ids.length&&tp&&tp.primaryFolderId)ids.push(tp.primaryFolderId);
    if(!ids.length&&tp&&tp.folderId)ids.push(tp.folderId);
    return Array.from(new Set(ids.filter(Boolean)));
  }
  function tpWorkZoneIds(tp){
    const ids=keysTrue(tp&&tp.workZones);
    if(!ids.length&&tp&&tp.primaryWorkZoneId)ids.push(tp.primaryWorkZoneId);
    if(!ids.length&&tp&&tp.workZoneId)ids.push(tp.workZoneId);
    return Array.from(new Set(ids.filter(Boolean)));
  }
  function ancestors(folderId,folders){
    const found=[],seen=new Set();let current=folderId,guard=0;
    while(current&&current!=='root'&&!seen.has(current)&&guard<150){
      found.push(current);seen.add(current);
      current=folders[current]&&folders[current].parentId;
      guard++;
    }
    return found;
  }
  function ancestorFolderIds(tp,folders){
    const found=new Set();tpFolderIds(tp).forEach(function(id){ancestors(id,folders).forEach(function(parent){found.add(parent);});});return Array.from(found);
  }
  function topRoots(ids,folders){
    const unique=Array.from(new Set((ids||[]).filter(Boolean)));
    const set=new Set(unique);
    return unique.filter(function(id){return !ancestors(id,folders).slice(1).some(function(parent){return set.has(parent);});});
  }
  async function indexVersion(){
    if(indexVersionCache!==null)return indexVersionCache;
    try{indexVersionCache=Number((await db().ref('AccessIndexMeta/version').once('value')).val()||0);}catch(_e){indexVersionCache=0;}
    return indexVersionCache;
  }
  function userFolderRoots(user,zones){
    const ids=keysTrue(user&&user.folders);
    const zone=user&&user.workZoneId&&zones&&zones[user.workZoneId];
    keysTrue(zone&&zone.folders).forEach(function(id){ids.push(id);});
    return Array.from(new Set(ids.filter(Boolean)));
  }
  function accessibleFolderIds(folders){
    const account=me();
    if(!account)return [];
    if(window.HETKAuth&&window.HETKAuth.getAccessibleFolderIds){
      return window.HETKAuth.getAccessibleFolderIds(folders||{});
    }
    return keysTrue(account.folders);
  }
  async function mapLimit(values,limit,worker){
    let cursor=0;
    const jobs=Array.from({length:Math.min(limit,values.length)},async function(){
      while(cursor<values.length){const index=cursor++;await worker(values[index],index);}
    });
    await Promise.all(jobs);
  }
  async function readFolders(){return (await db().ref('Folders').once('value')).val()||{};}
  async function readTPs(force){
    const account=me();if(!account)return snapshot({});
    if(!force&&Object.keys(tpCache).length)return snapshot(tpCache);
    if(globalTPAccount(account)){tpCache=(await db().ref('TPs').once('value')).val()||{};return snapshot(tpCache);}
    const folders=await readFolders(),allowed=accessibleFolderIds(folders),result={};
    const optimized=(await indexVersion())>=INDEX_VERSION;
    if(optimized&&(account.role==='master'||account.role==='electrician')&&account.workZoneId){
      tpCache=(await db().ref('TPsByWorkZone/'+account.workZoneId).once('value')).val()||{};return snapshot(tpCache);
    }
    const paths=optimized?topRoots(allowed,folders):allowed;
    await mapLimit(paths,12,async function(folderId){
      const path=(optimized?'TPsByAncestor/':'TPsByFolder/')+folderId;
      const rows=(await db().ref(path).once('value')).val()||{};
      Object.keys(rows).forEach(function(id){if(!result[id])result[id]=rows[id];});
    });
    tpCache=result;return snapshot(result);
  }
  async function readTP(id){
    if(tpCache[id])return snapshot(tpCache[id]);
    const all=(await readTPs(true)).val();return snapshot(all[id]||null);
  }
  async function readUsers(force){
    const account=me();if(!account)return snapshot({});
    if(!force&&Object.keys(userCache).length)return snapshot(userCache);
    if(globalAccount(account)){userCache=(await db().ref('users').once('value')).val()||{};return snapshot(userCache);}
    const folders=await readFolders(),allowed=accessibleFolderIds(folders),result={},optimized=(await indexVersion())>=INDEX_VERSION;
    const paths=optimized?topRoots(allowed,folders):allowed;
    await mapLimit(paths,12,async function(folderId){
      const path=(optimized?'UsersByAncestor/':'UsersByFolder/')+folderId;
      const rows=(await db().ref(path).once('value')).val()||{};
      Object.keys(rows).forEach(function(uid){if(!result[uid])result[uid]=rows[uid];});
    });
    const own=(await db().ref('users/'+account.uid).once('value')).val();if(own)result[account.uid]=own;
    if(account.actingForUid){const absent=(await db().ref('users/'+account.actingForUid).once('value')).val();if(absent)result[account.actingForUid]=absent;}
    userCache=result;return snapshot(result);
  }
  async function saveTP(id,value,before){
    const folders=await readFolders(),updates={};updates['TPs/'+id]=value;
    tpFolderIds(before).forEach(function(folderId){if(!tpFolderIds(value).includes(folderId))updates['TPsByFolder/'+folderId+'/'+id]=null;});
    tpFolderIds(value).forEach(function(folderId){updates['TPsByFolder/'+folderId+'/'+id]=value;});
    const oldAncestors=ancestorFolderIds(before,folders),newAncestors=ancestorFolderIds(value,folders);
    oldAncestors.forEach(function(folderId){if(!newAncestors.includes(folderId))updates['TPsByAncestor/'+folderId+'/'+id]=null;});
    newAncestors.forEach(function(folderId){updates['TPsByAncestor/'+folderId+'/'+id]=value;});
    const oldZones=tpWorkZoneIds(before),newZones=tpWorkZoneIds(value);
    oldZones.forEach(function(zoneId){if(!newZones.includes(zoneId))updates['TPsByWorkZone/'+zoneId+'/'+id]=null;});
    newZones.forEach(function(zoneId){updates['TPsByWorkZone/'+zoneId+'/'+id]=value;});
    await db().ref().update(updates);tpCache[id]=value;document.dispatchEvent(new CustomEvent('hetk-scoped-data-changed',{detail:{type:'tps',id:id}}));
  }
  async function removeTP(id,before,additionalUpdates){
    const folders=await readFolders(),updates=Object.assign({},additionalUpdates||{});updates['TPs/'+id]=null;tpFolderIds(before).forEach(function(folderId){updates['TPsByFolder/'+folderId+'/'+id]=null;});
    ancestorFolderIds(before,folders).forEach(function(folderId){updates['TPsByAncestor/'+folderId+'/'+id]=null;});
    tpWorkZoneIds(before).forEach(function(zoneId){updates['TPsByWorkZone/'+zoneId+'/'+id]=null;});
    await db().ref().update(updates);delete tpCache[id];document.dispatchEvent(new CustomEvent('hetk-scoped-data-changed',{detail:{type:'tps',id:id}}));
  }
  function descendants(rootId,folders){
    const found=[];const queue=[rootId],seen=new Set();
    while(queue.length){const id=queue.shift();if(!id||seen.has(id))continue;seen.add(id);found.push(id);Object.keys(folders).forEach(function(child){if(folders[child]&&folders[child].parentId===id)queue.push(child);});}
    return found;
  }
  function userIndexUpdates(uid,user,oldUser,folders,zones){
    const updates={},oldRoots=userFolderRoots(oldUser,zones),newRoots=userFolderRoots(user,zones);
    oldRoots.forEach(function(id){if(!newRoots.includes(id))updates['UsersByFolder/'+id+'/'+uid]=null;});
    newRoots.forEach(function(id){updates['UsersByFolder/'+id+'/'+uid]=user;});
    const oldAncestors=new Set(),newAncestors=new Set();
    oldRoots.forEach(function(id){ancestors(id,folders).forEach(function(parent){oldAncestors.add(parent);});});
    newRoots.forEach(function(id){ancestors(id,folders).forEach(function(parent){newAncestors.add(parent);});});
    oldAncestors.forEach(function(id){if(!newAncestors.has(id))updates['UsersByAncestor/'+id+'/'+uid]=null;});
    newAncestors.forEach(function(id){updates['UsersByAncestor/'+id+'/'+uid]=user;});
    const oldAccess=new Set();oldRoots.forEach(function(id){descendants(id,folders).forEach(function(x){oldAccess.add(x);});});
    const newAccess=new Set();newRoots.forEach(function(id){descendants(id,folders).forEach(function(x){newAccess.add(x);});});
    if(oldUser&&(oldUser.rootAccess||['director','chief_engineer','republic_tb_engineer','chief_dispatcher','dispatcher'].includes(oldUser.role)))Object.keys(folders).forEach(function(id){oldAccess.add(id);});
    if(user&&(user.rootAccess||['director','chief_engineer','republic_tb_engineer','chief_dispatcher','dispatcher'].includes(user.role)))Object.keys(folders).forEach(function(id){newAccess.add(id);});
    oldAccess.forEach(function(id){if(!newAccess.has(id))updates['FolderAccess/'+uid+'/'+id]=null;});
    newAccess.forEach(function(id){updates['FolderAccess/'+uid+'/'+id]=true;});
    return updates;
  }
  async function syncUserAccess(uid,user,oldUser){
    const values=await Promise.all([readFolders(),db().ref('WorkZones').once('value')]),folders=values[0],zones=values[1].val()||{};
    const updates=userIndexUpdates(uid,user,oldUser||{},folders,zones);await db().ref().update(updates);userCache[uid]=user;
    document.dispatchEvent(new CustomEvent('hetk-scoped-data-changed',{detail:{type:'users',id:uid}}));
  }
  async function syncDelegation(row,active){
    if(!row||!row.delegateUid)return;
    const path='DelegatedFolderAccess/'+row.delegateUid;
    if(!active){await db().ref(path).remove();return;}
    const visibleUsers=(await readUsers(true)).val()||{},absent=visibleUsers[row.absentUid]||{},folders=await readFolders(),zones=(await db().ref('WorkZones').once('value')).val()||{},access={};
    userFolderRoots(absent,zones).forEach(function(root){descendants(root,folders).forEach(function(id){access[id]=true;});});
    await db().ref(path).set({delegationId:row.id,absentUid:row.absentUid,folders:access,workZoneId:absent.workZoneId||'',expiresAt:row.endDate?new Date(row.endDate+'T23:59:59').getTime():0,status:'active'});
  }
  async function chunkedUpdate(updates,onProgress){
    const entries=Object.entries(updates),size=180,total=Math.max(1,Math.ceil(entries.length/size));
    for(let i=0;i<entries.length;i+=size){const part={};entries.slice(i,i+size).forEach(function(row){part[row[0]]=row[1];});await db().ref().update(part);if(onProgress)onProgress(Math.min(total,Math.floor(i/size)+1),total);}
  }
  async function migrate(onProgress){
    const account=me();if(!(account&&(account.rootAccess||account.role==='super_admin')))throw new Error('Migratsiyani faqat bosh administrator bajaradi.');
    const snaps=await Promise.all(['Folders','WorkZones','users','TPs','TemporaryDelegations'].map(function(path){return db().ref(path).once('value');}));
    const folders=snaps[0].val()||{},zones=snaps[1].val()||{},users=snaps[2].val()||{},tps=snaps[3].val()||{},delegations=snaps[4].val()||{},updates={};
    Object.keys(tps).forEach(function(id){
      tpFolderIds(tps[id]).forEach(function(folderId){updates['TPsByFolder/'+folderId+'/'+id]=tps[id];});
      ancestorFolderIds(tps[id],folders).forEach(function(folderId){updates['TPsByAncestor/'+folderId+'/'+id]=tps[id];});
      tpWorkZoneIds(tps[id]).forEach(function(zoneId){updates['TPsByWorkZone/'+zoneId+'/'+id]=tps[id];});
    });
    Object.keys(users).forEach(function(uid){Object.assign(updates,userIndexUpdates(uid,users[uid]||{},null,folders,zones));});
    await db().ref('AccessIndexMeta/version').set(1);indexVersionCache=1;
    await Promise.all(['TPsByAncestor','TPsByWorkZone','UsersByAncestor','UsersByFolder','FolderAccess','DelegatedFolderAccess'].map(function(path){return db().ref(path).remove();}));
    await chunkedUpdate(updates,onProgress);
    for(const id of Object.keys(delegations)){const row=Object.assign({id:id},delegations[id]||{});if(row.status==='active')await syncDelegation(row,true);}
    await db().ref('AccessIndexMeta').set({version:INDEX_VERSION,completedAt:Date.now(),completedBy:account.uid,tpCount:Object.keys(tps).length,userCount:Object.keys(users).length});
    indexVersionCache=INDEX_VERSION;tpCache={};userCache={};return {tpCount:Object.keys(tps).length,userCount:Object.keys(users).length};
  }
  function clear(){tpCache={};userCache={};indexVersionCache=null;}
  document.addEventListener('hetk-auth-cleared',clear);
  document.addEventListener('hetk-auth-user-updated',clear);
  window.HETKData={INDEX_VERSION,readTPs,readTP,readUsers,saveTP,removeTP,syncUserAccess,syncDelegation,migrate,clear,isGlobal:function(){const account=me();return !!(account&&(account.rootAccess||account.role==='super_admin'));}};
})();
