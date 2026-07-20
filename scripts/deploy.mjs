/* eslint-disable jsdoc/require-jsdoc -- small private deployment helpers */
import {
    cpSync,
    existsSync,
    mkdirSync,
    readdirSync,
    rmSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = resolve(projectRoot, 'dist');
const deploymentDirectory = resolve(projectRoot, 'deployment');
const removableDirectories = new Set(['dist', 'deployment']);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function removeBuildDirectory(directory) {
    if (
        dirname(directory) !== projectRoot ||
        !removableDirectories.has(basename(directory))
    ) {
        throw new Error(`Refusing to remove unexpected deployment path: ${directory}`);
    }
    rmSync(directory, { recursive: true, force: true });
}

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
    });
    if (result.error) {
        throw result.error;
    }
    if (result.status !== 0) {
        throw new Error(`${command} ${args.join(' ')} exited with status ${result.status}`);
    }
}

function copyDirectoryContents(source, destination) {
    if (!existsSync(source)) {
        throw new Error(`Expected build output was not created: ${source}`);
    }
    mkdirSync(destination, { recursive: true });
    for (const entry of readdirSync(source)) {
        cpSync(join(source, entry), join(destination, entry), {
            recursive: true,
            force: true,
        });
    }
}

function build(script) {
    removeBuildDirectory(distDirectory);
    run(npmCommand, ['run', script]);
}

function clean() {
    removeBuildDirectory(distDirectory);
    removeBuildDirectory(deploymentDirectory);
}

function prepareDeployment() {
    clean();

    build('build');
    copyDirectoryContents(distDirectory, join(deploymentDirectory, 'dist'));

    build('build:alldeps');
    copyDirectoryContents(distDirectory, join(deploymentDirectory, 'dist'));

    build('build:site');
    copyDirectoryContents(distDirectory, deploymentDirectory);
    removeBuildDirectory(distDirectory);

    // VitePress documentation is copied last so its pages (including the
    // docs index) win over any same-named files from the site build.
    run(npmCommand, ['run', 'docs:build']);
    copyDirectoryContents(
        join(projectRoot, 'docs', '.vitepress', 'dist'),
        join(deploymentDirectory, 'docs'),
    );
}

const prepareOnly = process.argv.includes('--prepare-only');
const cleanOnly = process.argv.includes('--clean');

if (prepareOnly && cleanOnly) {
    throw new Error('--prepare-only and --clean cannot be used together');
}

if (cleanOnly) {
    clean();
} else {
    let prepared = false;
    try {
        prepareDeployment();
        prepared = true;
        if (!prepareOnly) {
            run(npmCommand, ['exec', '--', 'gh-pages', '-d', deploymentDirectory]);
        }
    } finally {
        if (!prepareOnly || !prepared) {
            clean();
        }
    }
}
