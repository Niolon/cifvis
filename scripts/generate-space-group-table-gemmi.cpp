// Generates src/lib/structure/space-group-table.js from Gemmi's MPL-2.0
// space-group database. Compile this file against a Gemmi source checkout:
//
// g++ -std=c++17 -I/path/to/gemmi/include \
//   scripts/generate-space-group-table-gemmi.cpp /path/to/gemmi/src/symmetry.cpp \
//   -o /tmp/generate-space-group-table
// /tmp/generate-space-group-table src/lib/structure/space-group-table.js

#include <fstream>
#include <iostream>
#include <string>

#include <gemmi/symmetry.hpp>

namespace {

std::string quoted(const std::string& value) {
    std::string result = "'";
    for (char character : value) {
        if (character == '\\' || character == '\'')
            result += '\\';
        result += character;
    }
    return result + "'";
}

} // namespace

int main(int argc, char** argv) {
    if (argc != 2) {
        std::cerr << "Usage: generate-space-group-table OUTPUT\n";
        return 2;
    }

    std::ofstream output(argv[1]);
    if (!output) {
        std::cerr << "Cannot open output file: " << argv[1] << '\n';
        return 1;
    }

    output << R"(/**
 * Ordered space-group settings generated from Gemmi's space-group database.
 *
 * Source: https://github.com/project-gemmi/gemmi
 * Revision: d6ccb33d4be318adfd8a73ae30ce3a01ed0c5a8d
 * License: Mozilla Public License 2.0 (the same license as cifvis).
 *
 * Gemmi's first 530 settings follow the order shared by SgInfo, sgtbx and the
 * International Tables. Operations are emitted in Gemmi's conventional order;
 * centring translations follow the primitive symmetry operations.
 *
 * DO NOT EDIT BY HAND. Regenerate with scripts/generate-space-group-table-gemmi.cpp.
 */
export const SPACE_GROUP_TABLE = Object.freeze([
)";

    for (const gemmi::SpaceGroup& group : gemmi::spacegroup_tables::main) {
        const gemmi::GroupOps operations = group.operations();
        output << "    {\n"
               << "        'number': " << group.number << ",\n"
               << "        'symbol_cif': " << quoted(group.hm) << ",\n"
               << "        'symbol_hm_short': " << quoted(group.short_name()) << ",\n"
               << "        'hall_symbol': " << quoted(group.hall) << ",\n"
               << "        'universal_h_m': " << quoted(group.xhm()) << ",\n"
               << "        'setting': " << quoted(group.qualifier) << ",\n"
               << "        'is_standard': "
               << (group.ccp4 == group.number ? "true" : "false") << ",\n"
               << "        'operations': [\n";
        for (int index = 0; index < operations.order(); ++index)
            output << "            " << quoted(operations.get_op(index).triplet()) << ",\n";
        output << "        ],\n"
               << "    },\n";
    }
    output << "]);\n";
}
