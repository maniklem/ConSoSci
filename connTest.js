 sql({
  query: `
    SELECT NAME
    FROM sys.objects where type='u' and name like 'WCSPROGRAMS_KoboBnsAnswer%'
   `,
  });
  
  //alterState(state=>{
    //console.log(JSON.stringify(state.references, null, 2));
    //return state;
  //}) 
  

sql({
  query: `
    SELECT *
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_NAME = 'WCSPROGRAMS_KoboNgrtNgrtanswer'`,
});

sql({
  query: `
    SELECT WCSPROGRAMS_ProjectAnnualDataPlanDataSetID 
    FROM WCSPROGRAMS_ProjectAnnualDataSet 
    WHERE DataSetUUIDID = '86638832camera_trapping'`
  
});

alterState(state=>{
  console.log(JSON.stringify(state.references, null, 2));
  return state;
}) 

// sql({
//   query: `
//     SELECT @@VERSION;
//   `,
// });
