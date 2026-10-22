// Runs against the configured PostgreSQL database and ALWAYS rolls the transaction back.
const fs=require('fs'),Module=require('module'),assert=require('assert'),path=require('path'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
(async()=>{
 const {createConnection}=require('typeorm');const cfg=require(path.join(root,'dist/config/config.service')).configService.getTypeOrmConfig();
 const c=await createConnection({...cfg,synchronize:false,migrationsRun:false,logging:false});const q=c.createQueryRunner();
 try{await q.connect();await q.startTransaction();
  const filename=path.join(root,'migration.cjs');const m=new Module(filename,module);m.paths=module.paths;
  const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/migrations/1792700000000-ClinicalIdentityAndEvaluationScope.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2018}}).outputText;
  m._compile(code,filename);
  const credentialsBefore=await q.query('SELECT id,username,password,"isSuperUser" FROM "user" ORDER BY id');
  const rolesBefore=await q.query('SELECT * FROM user_role ORDER BY "userId","roleId"');
  await new m.exports.ClinicalIdentityAndEvaluationScope1792700000000().up(q);
  const differences=await q.query(`SELECT count(*)::int AS n FROM patient p JOIN "user" u ON u.id=p."userId" WHERE p."deletedAt" IS NULL AND u."deletedAt" IS NULL AND
    (ROW(p."firstName",p."middleName",p."lastName",p.email,p.phone) IS DISTINCT FROM ROW(u."firstName",u."middleName",u."lastName",u.email,u.phone) OR
    ARRAY(SELECT "departmentId" FROM patient_department WHERE "patientId"=p.id ORDER BY 1) <> ARRAY(SELECT "departmentId" FROM user_department WHERE "userId"=u.id ORDER BY 1))`);
  assert.strictEqual(differences[0].n,0);console.log('PASS reconciliation uses clinical profiles');
  const [p]=await q.query('SELECT id,"userId" FROM patient WHERE "userId" IS NOT NULL AND "deletedAt" IS NULL LIMIT 1');
  if(p){await q.query('UPDATE patient SET "firstName"=$1 WHERE id=$2',['ClinicalSyncProbe',p.id]);
   const [u]=await q.query('SELECT "firstName" FROM "user" WHERE id=$1',[p.userId]);assert.strictEqual(u.firstName,'ClinicalSyncProbe');
   await q.query('UPDATE "user" SET "lastName"=$1 WHERE id=$2',['AccountSyncProbe',p.userId]);
   const [again]=await q.query('SELECT "lastName" FROM patient WHERE id=$1',[p.id]);assert.strictEqual(again.lastName,'AccountSyncProbe');
   console.log('PASS identity synchronization in both directions');
   const [d]=await q.query('SELECT id FROM department WHERE id NOT IN (SELECT "departmentId" FROM patient_department WHERE "patientId"=$1) LIMIT 1',[p.id]);
   if(d){await q.query('INSERT INTO patient_department("patientId","departmentId") VALUES($1,$2)',[p.id,d.id]);
    assert.strictEqual((await q.query('SELECT 1 FROM user_department WHERE "userId"=$1 AND "departmentId"=$2',[p.userId,d.id])).length,1);
    await q.query('DELETE FROM user_department WHERE "userId"=$1 AND "departmentId"=$2',[p.userId,d.id]);
    assert.strictEqual((await q.query('SELECT 1 FROM patient_department WHERE "patientId"=$1 AND "departmentId"=$2',[p.id,d.id])).length,0);
    console.log('PASS department synchronization in both directions');}
  }
  const [caregiver]=await q.query('SELECT id,"userId" FROM caregiver WHERE "userId" IS NOT NULL AND "deletedAt" IS NULL LIMIT 1');
  if(caregiver){
   await q.query('UPDATE caregiver SET "firstName"=$1 WHERE id=$2',['CaregiverSyncProbe',caregiver.id]);
   assert.strictEqual((await q.query('SELECT "firstName" FROM "user" WHERE id=$1',[caregiver.userId]))[0].firstName,'CaregiverSyncProbe');
   await q.query('UPDATE "user" SET "lastName"=$1 WHERE id=$2',['CaregiverAccountProbe',caregiver.userId]);
   assert.strictEqual((await q.query('SELECT "lastName" FROM caregiver WHERE id=$1',[caregiver.id]))[0].lastName,'CaregiverAccountProbe');
   console.log('PASS caregiver identity synchronization in both directions');
   const expected=await q.query('SELECT DISTINCT pd."departmentId" FROM patient_caregiver pc JOIN patient p ON p.id=pc."patientId" JOIN patient_department pd ON pd."patientId"=p.id WHERE pc."caregiverId"=$1 AND pc."deletedAt" IS NULL AND p."deletedAt" IS NULL ORDER BY 1',[caregiver.id]);
   const actual=await q.query('SELECT "departmentId" FROM user_department WHERE "userId"=$1 ORDER BY 1',[caregiver.userId]);
   assert.deepStrictEqual(actual,expected);
   console.log('PASS caregiver departments inherit linked patients');
  }
  assert.deepStrictEqual(await q.query('SELECT id,username,password,"isSuperUser" FROM "user" ORDER BY id'),credentialsBefore);
  assert.deepStrictEqual(await q.query('SELECT * FROM user_role ORDER BY "userId","roleId"'),rolesBefore);
  console.log('PASS credentials and role permissions preserved');
 }finally{if(q.isTransactionActive)await q.rollbackTransaction();await q.release();await c.close();}
 console.log('PASS migration rolled back: no persisted changes from this test');
})().catch(e=>{console.error(e.stack);process.exitCode=1});
