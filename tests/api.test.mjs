import test from 'node:test';
import assert from 'node:assert/strict';
import {listingApi,listingPayload} from '../src/api.js';
test('demo session cannot create persistent listings',()=>assert.throws(()=>listingApi({demo:true},'tenant')));
test('writes exclude forged ownership and tenant',()=>assert.deepEqual(listingPayload({direction:'OFFER',title:'Chair',description:'Wood',category:'home',resourceKind:'physical',ownerId:'evil',tenantId:'evil',status:'CLOSED'},false),{direction:'OFFER',title:'Chair',description:'Wood',category:'home',resourceKind:'physical',location:null}));
test('tenant path and concurrency version travel through authenticated SDK',async()=>{let sent;const sdk={fetchWithAuth:async(path,options)=>{sent={path,options};return {ok:true,json:async()=>({})};}};await listingApi(sdk,'tenant-a').close('listing-b',3);assert.equal(sent.path,'/api/stir/tenants/tenant-a/listings/listing-b/close');assert.equal(sent.options.body,'{"version":3}');});
test('conflict fails instead of pretending an update succeeded',async()=>{const api=listingApi({fetchWithAuth:async()=>({ok:false,status:409,json:async()=>({})})},'t');await assert.rejects(api.update('x',{}),{message:'stir.http409'});});
