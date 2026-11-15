"""Publish the site to the team repository without touching that repository's checkout.

Run from anywhere:   python tools/publish.py "what changed"            (builds the two branches)
                     python tools/publish.py "what changed" --push     (builds, then pushes them)

It writes two branches in ../LEADERS_NASA, using a temporary index so the files checked out
there (the PSI data on main) are never read, moved or changed:

  freefall-website   origin/main plus this folder as firelab/. The source, for review and merging.
  gh-pages           this folder alone at the root. What GitHub Pages serves.

Files listed in firelab/.gitignore are left out of both. Nothing is ever force-pushed.
"""
import os
import pathlib
import subprocess
import sys
import tempfile

SITE = pathlib.Path(__file__).resolve().parent.parent          # .../firelab
ROOT = SITE.parent                                             # the folder that holds firelab and the repository
REPO = ROOT / 'LEADERS_NASA'
SOURCE, PAGES, BASE = 'freefall-website', 'gh-pages', 'origin/main'
TRAILER = 'Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>'


def git(*args, index=None, tree=None, check=True):
    env = dict(os.environ, GIT_DIR=str(REPO / '.git'), GIT_TERMINAL_PROMPT='0', GCM_INTERACTIVE='never')
    if index:
        env['GIT_INDEX_FILE'] = str(index)
    if tree:
        env['GIT_WORK_TREE'] = str(tree)
    done = subprocess.run(['git', *args], env=env, cwd=str(tree or REPO), capture_output=True, text=True, encoding='utf-8')
    if check and done.returncode:
        sys.exit(f"git {' '.join(args)} failed:\n{done.stderr.strip()}")
    return done.stdout.strip()


def tip(branch):
    return git('rev-parse', '--verify', '--quiet', f'refs/heads/{branch}', check=False) or None


def commit(branch, tree, parent, message):
    if parent and git('rev-parse', f'{parent}^{{tree}}') == tree:
        print(f'{branch}: nothing new')
        return parent
    args = ['commit-tree', tree, '-m', message, '-m', TRAILER]
    if parent:
        args += ['-p', parent]
    new = git(*args)
    git('update-ref', f'refs/heads/{branch}', new)
    print(f'{branch}: {new[:8]}')
    return new


def main():
    words = [a for a in sys.argv[1:] if not a.startswith('--')]
    if not words:
        sys.exit(__doc__)
    message = words[0]
    git('fetch', 'origin', 'main')
    with tempfile.TemporaryDirectory() as tmp:
        # 1. the source branch: everything already on it (or on main), plus firelab/
        parent = tip(SOURCE) or git('rev-parse', BASE)
        index = pathlib.Path(tmp) / 'source.index'
        git('read-tree', parent, index=index)
        git('add', '-A', '--', SITE.name, index=index, tree=ROOT)
        tree = git('write-tree', index=index)
        # safety: compared with main, the branch may only add or change files under firelab/
        outside = [p for p in git('diff', '--name-only', BASE, tree).splitlines() if not p.startswith(SITE.name + '/')]
        if outside:
            sys.exit('refusing to commit: files outside firelab/ would change, for example ' + ', '.join(outside[:5]))
        commit(SOURCE, tree, parent, message)

        # 2. the Pages branch: the site alone
        index = pathlib.Path(tmp) / 'pages.index'
        git('add', '-A', '.', index=index, tree=SITE)
        commit(PAGES, git('write-tree', index=index), tip(PAGES), message)

    print(git('diff', '--shortstat', BASE, SOURCE))
    if '--push' in sys.argv:
        print(git('push', 'origin', SOURCE, PAGES))
        print('pushed')
    else:
        print('built locally; add --push to send both branches to GitHub')


if __name__ == '__main__':
    main()
