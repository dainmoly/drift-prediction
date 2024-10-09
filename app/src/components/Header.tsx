import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import Link from "next/link";


export default function Header() {
  return (
    <div className="flex justify-between items-center gap-8">
      <Link href={"/"}>
        <span>
          Prediction Demo
        </span>
      </Link>

      <div className="flex-1 flex gap-6">

        <Link href={'/'}>
          Home
        </Link>

        <Link href={'/market'}>
          Markets
        </Link>

        <Menu>
          <MenuButton>Admin</MenuButton>
          <MenuItems anchor="bottom start" className="flex flex-col gap-2 bg-gray-50 divide-y divide-black/20 mt-4">
            <MenuItem>
              <Link href={'/admin'}>
                <div className="px-4 py-1.5 text-black/50 hover:text-black">
                  Initialize
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href={'/admin/update'}>
                <div className="px-4 py-1.5 text-black/50 hover:text-black">
                  Update Admin
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href={'/admin/oracle-guard'}>
                <div className="px-4 py-1.5 text-black/50 hover:text-black">
                  Update Oracle Rails Guard
                </div>
              </Link>
            </MenuItem>
          </MenuItems>
        </Menu>

        <Menu>
          <MenuButton>Tools</MenuButton>
          <MenuItems anchor="bottom start" className="flex flex-col gap-2 bg-gray-50 divide-y divide-black/20 mt-4">
            <MenuItem>
              <Link href={'/tools/create-token'}>
                <div className="px-4 py-1.5 text-black/50 hover:text-black">
                  Create Token
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href={'/tools/faucet'}>
                <div className="px-4 py-1.5 text-black/50 hover:text-black">
                  Faucet
                </div>
              </Link>
            </MenuItem>
            <MenuItem>
              <Link href={'/tools/pk'}>
                <div className="px-4 py-1.5 text-black/50 hover:text-black">
                  Retrieve PK
                </div>
              </Link>
            </MenuItem>
          </MenuItems>
        </Menu>

      </div>

      <div className="w-48">
        <WalletMultiButton />
      </div>
    </div>
  );
}
