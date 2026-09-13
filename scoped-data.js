(function(){
  'use strict';

  const INDEX_VERSION=1;
  const GLOBAL_ROLES=new Set(['super_admin','republic_tb_engineer']);
  const GLOBAL_TP_ROLES=new Set(['super_admin','republic_tb_engineer','chief_dispatcher','dispatcher']);
  let tpCache={};
  let userCache={};

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
    await mapLimit(allowed,12,async function(folderId){
      const rows=(await db().ref('TPsByFolder/'+folderId).once('value')).val()||{};
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
    const folders=await readFolders(),allowed=accessibleFolderIds(folders),result={};
    await mapLimit(allowed,12,async function(folderId){
      const rows=(await db().ref('UsersByFolder/'+folderId).once('value')).val()||{};
      Object.keys(rows).forEach(function(uid){if(!result[uid])result[uid]=rows[uid];});
    });
    const own=(await db().ref('users/'+account.uid).once('value')).val();if(own)result[account.uid]=own;
    if(account.actingForUid){const absent=(await db().ref('users/'+account.actingForUid).once('value')).val();if(absent)result[account.actingForUid]=absent;}
    userCache=result;return snapshot(result);
  }
  async function saveTP(id,value,before){
    const updates={};updates['TPs/'+id]=value;
    tpFolderIds(before).forEach(function(folderId){if(!tpFolderIds(value).includes(folderId))updates['TPsByFolder/'+folderId+'/'+id]=null;});
    tpFolderIds(value).forEach(function(folderId){updates['TPsByFolder/'+folderId+'/'+id]=value;});
    await db().ref().update(updates);tpCache[id]=value;document.dispatchEvent(new CustomEvent('hetk-scoped-data-changed',{detail:{type:'tps',id:id}}));
  }
  async function removeTP(id,before,additionalUpdates){
    const updates=Object.assign({},additionalUpdates||{});updates['TPs/'+id]=null;tpFolderIds(before).forEach(function(folderId){updates['TPsByFolder/'+folderId+'/'+id]=null;});
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
    const oldAccess=new Set();oldRoots.forEach(function(id){descendants(id,folders).forEach(function(x){oldAccess.add(x);});});
    const newAccess=new Set();newRoots.forEach(function(id){descendants(id,folders).forEach(function(x){newAccess.add(x);});});
    if(oldUser&&(oldUser.rootAccess||['republic_tb_engineer','chief_dispatcher','dispatcher'].includes(oldUser.role)))Object.keys(folders).forEach(function(id){oldAccess.add(id);});
    if(user&&(user.rootAccess||['republic_tb_engineer','chief_dispatcher','dispatcher'].includes(user.role)))Object.keys(folders).forEach(function(id){newAccess.add(id);});
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
    const absent=(await db().ref('users/'+row.absentUid).once('value')).val()||{},folders=await readFolders(),zones=(await db().ref('WorkZones').once('value')).val()||{},access={};
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
    Object.keys(tps).forEach(function(id){tpFolderIds(tps[id]).forEach(function(folderId){updates['TPsByFolder/'+folderId+'/'+id]=tps[id];});});
    Object.keys(users).forEach(function(uid){Object.assign(updates,userIndexUpdates(uid,users[uid]||{},null,folders,zones));});
    await Promise.all(['TPsByFolder','UsersByFolder','FolderAccess','DelegatedFolderAccess'].map(function(path){return db().ref(path).remove();}));
    await chunkedUpdate(updates,onProgress);
    for(const id of Object.keys(delegations)){const row=Object.assign({id:id},delegations[id]||{});if(row.status==='active')await syncDelegation(row,true);}
    await db().ref('AccessIndexMeta').set({version:INDEX_VERSION,completedAt:Date.now(),completedBy:account.uid,tpCount:Object.keys(tps).length,userCount:Object.keys(users).length});
    tpCache={};userCache={};return {tpCount:Object.keys(tps).length,userCount:Object.keys(users).length};
  }
  function clear(){tpCache={};userCache={};}
  document.addEventListener('hetk-auth-cleared',clear);
  document.addEventListener('hetk-auth-user-updated',clear);
  window.HETKData={INDEX_VERSION,readTPs,readTP,readUsers,saveTP,removeTP,syncUserAccess,syncDelegation,migrate,clear,isGlobal:function(){const account=me();return !!(account&&(account.rootAccess||account.role==='super_admin'));}};
})();
