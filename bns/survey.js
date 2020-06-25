// Built for Microsoft SQL Azure (RTM) - 12.0.2000.8
sql(state => {
  const { data } = state;
  return (
    `insert into "WCSPROGRAMS_KoboBnsAnswer" ("` +
    [
      'DatasetUuidId'
    ].join('", "') +
    `") values ('` +
    [
      data._uuid,
    ]
      .join("', '")
      .replace(/''/g, null) +
    `') ON CONFLICT UPDATE THE PARENT;`
    // This VERY STRONG language in the 'on conflict' ensures that we don't
    // create duplicate children. When a submission is reprocessed, the
    // agreement is that whatever children appear for _that_ submission are the
    // final children which will appear in the DB. (i.e., no historical record.)
  );
});

sql(state => {
  const { data } = state;
  // state.data.hhmembers.map()
  return (
    `insert into "WCSPROGRAMS_KoboBnsAnswerhhmembers" ("` +
    [
      'AnswerId'
    ].join('", "') +
    `") values ('` +
    [
      data._uuid,
    ]
      .join("', '")
      .replace(/''/g, null) +
    `');`
  );
});