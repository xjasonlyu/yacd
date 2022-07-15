NAME   = yacd
PUBLIC = public

all: install build pack

install:
	npm i -g pnpm
	pnpm i

build:
	pnpm build

pack:
	zip -r $(NAME).zip $(PUBLIC)
