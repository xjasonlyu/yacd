NAME = yacd
PUBLIC = public

all: install lint build pack

install:
	yarn

lint:
	yarn lint

build:
	yarn build

pack:
	tar -czvf $(NAME).tar.gz $(PUBLIC)
