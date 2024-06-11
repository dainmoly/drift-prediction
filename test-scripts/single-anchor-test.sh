if [ "$1" != "--skip-build" ]
  then
    anchor build --arch sbf &&
    cp target/idl/drift.json sdk/src/idl/
fi

test_files=(assetTier.ts)

for test_file in ${test_files[@]}; do
  SBF_OUT_DIR=/target/deploy ANCHOR_TEST_FILE=${test_file} anchor test --arch sbf || exit 1;
done
