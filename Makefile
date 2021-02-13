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
	zip -r $(NAME).zip $(PUBLIC)
