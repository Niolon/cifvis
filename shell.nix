{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [ nodejs ];
  shellHook = ''
    export PATH="$PWD/node_modules/.bin:$PATH"
  '';
}
