'use client'
import React, {FC, useState} from 'react'
import Heading from './utils/Heading'
import Header from './components/Header'


interface Props {}

const Page: FC<Props> = (props) => {
  const [open, setOpen] = useState(false);
  const [activeItem, setActiveItem] = useState(0);

  return (
    <div>
      <Heading
      title='I See Tea'
      description='See Freely with ICT SMC simplified'
      keywords='ICT, SMC, simplified, see, freely, tea'
      />
      <Header
      open={open}
      setOpen={setOpen}
      activeItem={activeItem}
      />
    </div>
  )
};

export default Page;