if [ "$1" != "--skip-build" ]
  then
    anchor build &&
    cp target/idl/clearing_house.json sdk/src/idl/ 
    # cd sdk && yarn build && cd ../
fi

test_files=(clearingHouse.ts)
test_files=(liquidityProvider.ts)

for test_file in ${test_files[@]}; do
  ANCHOR_TEST_FILE=${test_file} anchor test --skip-build || exit 1;
done
